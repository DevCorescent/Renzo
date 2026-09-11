// ============================================================================
// OWNER: Aman | MODULE: Branch Settings
// ROUTE : /api/v1/admin/branches/:id/settings
//
// This is the salon's PAYMENT AND TAX CONFIGURATION: the GST rate and name, the
// tax number printed on invoices, which payment rails are open, the invoice
// prefix, and the till's paper size.
//
// ACCESS — SUPER_ADMIN, OWNER, BRANCH_ADMIN (own branch only).
//   A RECEPTIONIST is deliberately absent: the front desk COLLECTS payments and
//   reads history, but never changes what is charged or how money can be taken.
//   A WORKER has no access at all.
//
// THE HOLE THIS FIXES
// -------------------
// The role list was right but there was NO BRANCH SCOPING, so any branch admin
// could read and rewrite ANY branch's tax rate, payment rails and invoice
// numbering by putting another branch's id in the URL. That is privilege
// escalation across the franchise boundary, and it is what requireBranchScope()
// exists to stop.
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { writeAudit } from "@/lib/audit";
import prisma from "@/lib/db";

const MODULE = "BRANCH_SETTINGS";
const ROLES = ["SUPER_ADMIN", "OWNER", "BRANCH_ADMIN"] as const;

/**
 * Settings a human may change. Never spread the raw body into the database — an
 * un-whitelisted key here is a branch rewriting a column the UI never exposed.
 */
const EDITABLE = [
  "currency",
  "currencySymbol",
  // ── Tax / GST ──
  "taxPercent",
  "taxName",
  "taxNumber",
  // ── Booking policy ──
  "advanceBookingDays",
  "minAdvanceBookingHours",
  "maxBookingsPerSlot",
  "cancellationHours",
  "cancellationChargeType",
  "cancellationCharge",
  "rescheduleHours",
  "autoConfirmBookings",
  "requireDepositPercent",
  "requireLoginToBook",
  // ── Programmes ──
  "loyaltyEnabled",
  "membershipEnabled",
  // ── Payment rails ──
  "onlinePaymentEnabled",
  "offlinePaymentEnabled",
  // ── Billing / printing ──
  "invoicePrefix",
  "receiptPrefix",
  "printFormat",
  "allowReceptionBlankBill",
  // ── Invoice display ──
  "invoiceBusinessName",
  "invoiceTagline",
  "invoiceAddress",
  "invoicePhone",
  "invoiceEmail",
  "invoiceWebsite",
  "invoiceFooterNote",
] as const;

const PRINT_FORMATS = ["A4", "THERMAL_80", "THERMAL_58"];

/** The branch this request may touch, or an error response. */
async function resolveBranch(req: NextRequest, id: string) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return { error } as const;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return { error: scopeError } as const;

  // A branch-scoped admin may only ever reach their OWN branch. 404 rather than
  // 403 so another branch's existence is not confirmed.
  if (!scope.isGlobal && id !== scope.branchId) {
    return { error: err("Branch not found", 404) } as const;
  }

  const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
  if (!branch) return { error: err("Branch not found", 404) } as const;

  return { user } as const;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guard = await resolveBranch(req, id);
    if ("error" in guard) return guard.error;

    // Upsert-on-read: every branch always resolves to a settings row (defaults
    // come from the schema when the row is first created).
    const settings = await prisma.branchSetting.upsert({
      where: { branchId: id },
      update: {},
      create: { branchId: id },
    });

    return ok(settings);
  } catch {
    return err("Internal server error", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const guard = await resolveBranch(req, id);
    if ("error" in guard) return guard.error;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const patch = Object.fromEntries(
      Object.entries(body).filter(([k]) => (EDITABLE as readonly string[]).includes(k))
    );
    if (Object.keys(patch).length === 0) {
      return err("No valid settings to update", 422);
    }

    // ── Value validation ──────────────────────────────────────────────────
    // A tax rate is money: a typo here silently mis-bills every future invoice,
    // so it is checked rather than trusted.
    const errors: Record<string, string[]> = {};

    if ("taxPercent" in patch) {
      const v = Number(patch.taxPercent);
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        errors.taxPercent = ["Must be between 0 and 100"];
      }
    }
    if ("requireDepositPercent" in patch) {
      const v = Number(patch.requireDepositPercent);
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        errors.requireDepositPercent = ["Must be between 0 and 100"];
      }
    }
    if ("printFormat" in patch && !PRINT_FORMATS.includes(String(patch.printFormat))) {
      errors.printFormat = [`Must be one of ${PRINT_FORMATS.join(", ")}`];
    }
    for (const key of ["advanceBookingDays", "minAdvanceBookingHours", "maxBookingsPerSlot"]) {
      if (!(key in patch)) continue;
      const v = Number(patch[key]);
      if (!Number.isInteger(v) || v < 0) errors[key] = ["Must be a whole number, zero or more"];
    }
    if (Object.keys(errors).length > 0) return err("Validation failed", 422, errors);

    const before = await prisma.branchSetting.findUnique({ where: { branchId: id } });

    const settings = await prisma.branchSetting.upsert({
      where: { branchId: id },
      update: patch,
      create: { branchId: id, ...patch },
    });

    // Payment and tax configuration is exactly the kind of change a dispute later
    // turns on, so the before-image is kept.
    await writeAudit(guard.user, {
      action: "UPDATE",
      module: MODULE,
      refId: id,
      refType: "BranchSetting",
      oldValue: before ? JSON.parse(JSON.stringify(before)) : undefined,
      newValue: JSON.parse(JSON.stringify(patch)),
    });

    return ok(settings, "Settings updated");
  } catch {
    return err("Internal server error", 500);
  }
}
