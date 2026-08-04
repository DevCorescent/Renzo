// ============================================================================
// MODULE : Billing — the shared invoicing core
//
// ONE invoice engine, three doors:
//   • an APPOINTMENT bill      (/api/v1/reception/billing)
//   • a BLANK bill             (/api/v1/reception/billing/blank)  — no appointment
//   • a DIRECT SALE            (/api/v1/reception/sale)
// All three write the same Invoice + InvoiceItem rows, take tax from the same
// branch setting, and move stock through the same lib/stock.ts. Reports,
// accounting and analytics therefore cannot tell them apart, which is the point.
//
// TWO BUGS THIS FIXES
// -------------------
// 1. TAX WAS NEVER CHARGED. Billing copied `appointment.taxAmount`, which every
//    booking path sets to 0 — so every invoice under-billed by the branch's GST.
//    Tax is now computed at invoice time from BranchSetting.taxPercent, which is
//    also the only correct place: the rate that applies is the one in force when
//    the bill is raised, not when the slot was booked weeks earlier.
// 2. NO BRANCH SCOPING. Any receptionist could invoice any branch's appointment.
//    `assertBillingAccess()` now settles both the branch and the role.
// ============================================================================

import type { InvoiceStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import type { BranchScope } from "@/lib/branch-scope";
import type { UserType } from "@/types/api";

export const round2 = (n: number) => Math.round(n * 100) / 100;

// ============================================================================
// PERMISSIONS
// ============================================================================

export type BillingCapability = {
  /** Raise an invoice from an appointment. */
  canBillAppointment: boolean;
  /** Raise an invoice with NO appointment behind it (products, misc, consultation). */
  canBlankBill: boolean;
  canRefund: boolean;
};

/**
 * Who may bill what.
 *
 * A RECEPTIONIST bills appointments at their own branch and nothing else — a
 * blank bill has no appointment to audit it against, so it stays with the people
 * accountable for the branch's numbers. A branch may opt its front desk in
 * through `allowReceptionBlankBill`, which is why this takes a setting.
 */
export function billingCapabilitiesFor(
  userType: UserType,
  branchAllowsReceptionBlankBill = false
): BillingCapability {
  switch (userType) {
    case "SUPER_ADMIN":
    case "OWNER":
      return { canBillAppointment: true, canBlankBill: true, canRefund: true };
    case "BRANCH_ADMIN":
      return { canBillAppointment: true, canBlankBill: true, canRefund: true };
    case "RECEPTIONIST":
      return {
        canBillAppointment: true,
        canBlankBill: branchAllowsReceptionBlankBill,
        canRefund: false,
      };
    default:
      // Workers, customers, inventory/marketing/accounts roles: no invoicing.
      return { canBillAppointment: false, canBlankBill: false, canRefund: false };
  }
}

/** The branch a bill may be raised against, or a reason it may not. */
export type BillingAccess =
  | { ok: true; branchId: string; caps: BillingCapability; taxPercent: number; taxName: string }
  | { ok: false; status: number; message: string };

/**
 * Settle branch + role + tax rate in one query.
 *
 * `targetBranchId` is the branch the bill belongs to (the appointment's branch,
 * or the chosen branch for a blank bill). A scoped role that names another
 * branch is refused — this is the check whose absence let a receptionist invoice
 * another branch's appointment.
 */
export async function assertBillingAccess(params: {
  userType: UserType;
  scope: BranchScope;
  targetBranchId: string | null;
}): Promise<BillingAccess> {
  const { userType, scope, targetBranchId } = params;

  const branchId = scope.isGlobal ? targetBranchId : scope.branchId;
  if (!branchId) {
    return { ok: false, status: 422, message: "A branch is required to raise an invoice" };
  }

  // The tenancy check. A branch-scoped caller may only ever bill their own branch.
  if (!scope.isGlobal && targetBranchId && targetBranchId !== scope.branchId) {
    // 404, not 403 — another branch's appointment must not be discoverable.
    return { ok: false, status: 404, message: "Appointment not found" };
  }

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: {
      id: true,
      isActive: true,
      setting: {
        select: { taxPercent: true, taxName: true, allowReceptionBlankBill: true },
      },
    },
  });
  if (!branch || !branch.isActive) {
    return { ok: false, status: 404, message: "Branch not found" };
  }

  return {
    ok: true,
    branchId: branch.id,
    caps: billingCapabilitiesFor(userType, branch.setting?.allowReceptionBlankBill ?? false),
    taxPercent: branch.setting?.taxPercent ?? 0,
    taxName: branch.setting?.taxName ?? "Tax",
  };
}

// ============================================================================
// APPOINTMENT ELIGIBILITY
// ============================================================================

/**
 * Statuses a bill may be raised against.
 *
 * PENDING and CONFIRMED are excluded on purpose: the customer has not arrived, so
 * there is nothing to charge for yet — billing one would let a no-show be invoiced
 * as a completed visit. CANCELLED and NO_SHOW are excluded for the same reason.
 */
export const BILLABLE_STATUSES = ["CHECKED_IN", "STARTED", "COMPLETED"] as const;

export function appointmentBillableReason(status: string, hasInvoice: boolean): string | null {
  if (hasInvoice) return "An invoice already exists for this appointment";
  if (status === "CANCELLED") return "Cannot bill a cancelled appointment";
  if (status === "NO_SHOW") return "Cannot bill a no-show appointment";
  if (!(BILLABLE_STATUSES as readonly string[]).includes(status)) {
    return `This appointment is still ${status.toLowerCase().replace("_", " ")} — check the customer in before billing`;
  }
  return null;
}

// ============================================================================
// TOTALS
// ============================================================================

export type InvoiceLine = {
  type: string;
  refId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type InvoiceTotals = {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  tipAmount: number;
  roundOff: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: InvoiceStatus;
};

/**
 * The single money calculation behind every invoice in the product.
 *
 * ORDER MATTERS: discount comes off the subtotal, tax applies to what is left,
 * and the tip is added afterwards untaxed and undiscounted. Getting that order
 * wrong is the classic way a salon over-collects GST on a discounted bill.
 */
export function computeInvoiceTotals(params: {
  lines: InvoiceLine[];
  discountAmount?: number;
  taxPercent: number;
  tipAmount?: number;
  roundOff?: number;
  payments?: { amount: number }[];
}): InvoiceTotals | { error: string; field: string } {
  const subtotal = round2(params.lines.reduce((sum, l) => sum + l.total, 0));
  const discountAmount = round2(params.discountAmount ?? 0);

  if (discountAmount < 0) return { error: "Discount cannot be negative", field: "discountAmount" };
  if (discountAmount > subtotal) {
    return { error: "Discount cannot exceed the subtotal", field: "discountAmount" };
  }

  const taxable = Math.max(0, round2(subtotal - discountAmount));
  const taxAmount = round2((taxable * params.taxPercent) / 100);
  const tipAmount = round2(params.tipAmount ?? 0);
  const roundOff = round2(params.roundOff ?? 0);

  const totalAmount = Math.max(0, round2(taxable + taxAmount + tipAmount + roundOff));
  const paidAmount = round2((params.payments ?? []).reduce((sum, p) => sum + p.amount, 0));

  if (paidAmount > totalAmount) {
    return {
      error: `Payments (₹${paidAmount}) exceed the total (₹${totalAmount})`,
      field: "payments",
    };
  }

  const balanceDue = round2(Math.max(0, totalAmount - paidAmount));
  const status: InvoiceStatus =
    balanceDue <= 0 && totalAmount > 0 ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID";

  return {
    subtotal,
    discountAmount,
    taxAmount,
    tipAmount,
    roundOff,
    totalAmount,
    paidAmount,
    balanceDue,
    status,
  };
}

export function isTotalsError(
  value: InvoiceTotals | { error: string; field: string }
): value is { error: string; field: string } {
  return "error" in value;
}

/** The invoice line rows, including the tip line when there is one. */
export function toInvoiceItemRows(
  lines: InvoiceLine[],
  tipAmount: number
): Prisma.InvoiceItemCreateWithoutInvoiceInput[] {
  const rows: Prisma.InvoiceItemCreateWithoutInvoiceInput[] = lines.map((l) => ({
    type: l.type,
    refId: l.refId ?? null,
    name: l.name,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    total: l.total,
  }));

  if (tipAmount > 0) {
    rows.push({ type: "TIP", name: "Tip", quantity: 1, unitPrice: tipAmount, total: tipAmount });
  }

  return rows;
}
