import { NextRequest, NextResponse } from "next/server";
import type { InvoiceStatus, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { writeAudit } from "@/lib/audit";
import {
  billingCapabilitiesFor,
  isTotalsError,
  recomputeExistingInvoice,
  round2,
  type InvoiceTotals,
} from "@/lib/billing-service";
import { creditWallet } from "@/lib/wallet";
import { applyStockMovement, InsufficientStockError } from "@/lib/stock";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Reception Billing
// GET /api/v1/reception/billing/[id] — POS invoice detail
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        payments: { orderBy: { paidAt: "desc" } },
        refunds: { orderBy: { processedAt: "desc" } },
        appointment: {
          select: {
            appointmentNo: true,
            appointmentDate: true,
            startTime: true,
            status: true,
          },
        },
      },
    });

    if (!invoice) return err("Invoice not found", 404);

    // Branch-scoped roles may only read invoices from their own branch.
    const branchScoped = user.userType === "RECEPTIONIST" || user.userType === "BRANCH_ADMIN";
    if (branchScoped && user.branchId && invoice.branchId !== user.branchId) {
      return err("Forbidden — invoice belongs to another branch", 403);
    }

    return ok(invoice);
  } catch {
    return err("Internal server error", 500);
  }
}


// ============================================================================
// PATCH /api/v1/reception/billing/[id]
//
// Allowed updates:
//   • notes          — any status
//   • discountAmount, or `edit: { discountAmount?, items?: [{ id, quantity?,
//     unitPrice? }], tipAmount? }` — UNPAID / PARTIAL; on a PAID bill,
//     BRANCH_ADMIN and above only (recalculates totals — see "Correcting a paid
//     bill"). `dryRun: true` returns the figures the edit would produce and
//     writes nothing. A retail product's stock follows its corrected quantity.
//   • addItem / removeItemId — UNPAID / PARTIAL only
//   • NOT editable: customer, payments, invoice number, date, GST rate
//   • void (status → CANCELLED) — BRANCH_ADMIN / SUPER_ADMIN / OWNER only,
//     requires a voidReason
//
// CORRECTING A PAID BILL
// ----------------------
// A discount, quantity, price or tip keyed in wrong is found after the customer
// has paid. Payment rows
// are NEVER edited or deleted. When the corrected total falls below what has
// been collected, the excess goes back through the existing refund model — a
// Refund row, exactly as POST /admin/invoices/:id/refund writes, with
// paidAmount reduced by it — so paid, due and status stay true and the history
// shows both the original payment and the refund. A WALLET refund is credited
// to the customer's wallet (store credit) through lib/wallet.ts.
//
// Money only leaves with an explicit confirmation of the exact amount: the
// first request answers 409 with `data.refundRequired`, and the client resends
// with `refund: { method, amount }`. Only roles that may refund (BRANCH_ADMIN
// and above) can do this — the same rule as the refund route.
//
// Every recalculation keeps the bill's tip, round-off and the GST rate it was
// charged at (recomputeExistingInvoice), and each edit is one transaction that
// fails if the invoice changed underneath it (e.g. a payment landed meanwhile).
// ============================================================================

/** How the excess on a corrected bill can be handed back. */
const REFUND_METHODS: PaymentMethod[] = ["CASH", "UPI", "CARD", "ONLINE", "WALLET"];
const METHOD_LABEL: Record<string, string> = {
  CASH: "cash", UPI: "UPI", CARD: "card", ONLINE: "online", WALLET: "wallet credit",
};

/** Below a paisa is float noise, not money. */
const EPSILON = 0.01;

const APPOINTMENT_PAYMENT_STATUS: Record<InvoiceStatus, PaymentStatus> = {
  UNPAID: "PENDING",
  PARTIAL: "PARTIAL",
  PAID: "PAID",
  REFUNDED: "REFUNDED",
  CANCELLED: "CANCELLED",
};

const inr = (n: number) => `₹${round2(n).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** The Invoice columns a recalculation writes (tip / round-off live in the lines). */
function totalsData(t: InvoiceTotals) {
  return {
    subtotal: t.subtotal,
    discountAmount: t.discountAmount,
    taxAmount: t.taxAmount,
    totalAmount: t.totalAmount,
    paidAmount: t.paidAmount,
    balanceDue: t.balanceDue,
    status: t.status,
  };
}

class StaleInvoiceError extends Error {}

/**
 * Claim the invoice for this edit: succeeds only if it is unchanged since it
 * was read, so a payment or another edit in between cannot be overwritten with
 * totals worked out from stale figures.
 */
async function claimInvoice(tx: Prisma.TransactionClient, id: string, updatedAt: Date) {
  const { count } = await tx.invoice.updateMany({
    where: { id, updatedAt },
    data: { updatedAt: new Date() },
  });
  if (count === 0) throw new StaleInvoiceError();
}

/** Keep the source appointment's paid figure and status in step with its invoice. */
async function syncAppointment(
  tx: Prisma.TransactionClient,
  appointmentId: string | null,
  paidAmount: number,
  status: InvoiceStatus
) {
  if (!appointmentId) return;
  await tx.appointment.update({
    where: { id: appointmentId },
    data: { paidAmount, paymentStatus: APPOINTMENT_PAYMENT_STATUS[status] },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER", "RECEPTIONIST");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!invoice) return err("Invoice not found", 404);

    // requireBranchScope, as the refund route uses: an edit can now move money,
    // so a branch-scoped account with no branch on it is refused rather than
    // skipping the check.
    const { scope, error: scopeError } = requireBranchScope(user);
    if (scopeError) return scopeError;
    if (!scope.isGlobal && invoice.branchId !== scope.branchId) {
      return err("Forbidden — invoice belongs to another branch", 403);
    }

    const updates: Record<string, unknown> = {};

    // Notes — always editable
    if ("notes" in body) {
      updates.notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
    }

    // Void — admin-only
    if (body.void === true) {
      if (user.userType === "RECEPTIONIST") {
        return err("Only a Branch Admin or higher can void an invoice", 403);
      }
      if (invoice.status === "CANCELLED") {
        return err("Invoice is already voided", 409);
      }
      const voidReason = typeof body.voidReason === "string" ? body.voidReason.trim() : "";
      if (!voidReason) return err("Validation failed", 422, { voidReason: ["Reason is required to void an invoice"] });

      const updated = await prisma.invoice.update({
        where: { id },
        data: { status: "CANCELLED", notes: voidReason },
      });
      await writeAudit(user, {
        action: "UPDATE",
        module: "BILLING",
        refId: id,
        refType: "Invoice",
        newValue: { status: "CANCELLED", voidReason },
      });
      return ok(updated, "Invoice voided");
    }

    // Collected minus refunded. Invoice.paidAmount is the one figure every path
    // maintains (payments add, refunds subtract, an appointment's advance is
    // carried in at billing) — summing Payment rows alone would miss the advance.
    const netPaid = round2(Number(invoice.paidAmount));
    const branchTaxPercent = async () =>
      Number(
        (await prisma.branchSetting.findUnique({
          where: { branchId: invoice.branchId },
          select: { taxPercent: true },
        }))?.taxPercent ?? 0
      );

    // ── Remove a line item (UNPAID / PARTIAL only) ─────────────────────────
    if ("removeItemId" in body) {
      if (invoice.status !== "UNPAID" && invoice.status !== "PARTIAL") {
        return err("Line items can only be changed on an unpaid or partially paid invoice", 409);
      }
      const itemId = typeof body.removeItemId === "string" ? body.removeItemId : null;
      if (!itemId) return err("Validation failed", 422, { removeItemId: ["Item id is required"] });

      const item = invoice.items.find((i) => i.id === itemId);
      if (!item) return err("Invoice item not found", 404);
      if (item.type !== "TIP" && invoice.items.filter((i) => i.type !== "TIP").length <= 1) {
        return err("Cannot remove the last service item — void the invoice instead", 409);
      }

      // Totals are settled BEFORE anything is written, so a rejected change
      // (e.g. the discount would now exceed the subtotal) leaves the bill intact.
      const totals = recomputeExistingInvoice({
        invoice,
        items: invoice.items.filter((i) => i.id !== itemId),
        discountAmount: Number(invoice.discountAmount),
        branchTaxPercent: await branchTaxPercent(),
        netPaid,
      });
      if (isTotalsError(totals)) {
        return err("Validation failed", 422, { [totals.field]: [totals.error] });
      }

      const updated = await prisma.$transaction(async (tx) => {
        await claimInvoice(tx, id, invoice.updatedAt);
        await tx.invoiceItem.delete({ where: { id: itemId } });
        await syncAppointment(tx, invoice.appointmentId, totals.paidAmount, totals.status);
        return tx.invoice.update({ where: { id }, data: totalsData(totals), include: { items: true } });
      });
      await writeAudit(user, {
        action: "UPDATE", module: "BILLING", refId: id, refType: "Invoice",
        newValue: { removedItemId: itemId, totalAmount: totals.totalAmount } as Record<string, string | number | boolean | null>,
      });
      return ok(updated, "Item removed");
    }

    // ── Add a line item (UNPAID / PARTIAL only) ─────────────────────────────
    if ("addItem" in body) {
      if (invoice.status !== "UNPAID" && invoice.status !== "PARTIAL") {
        return err("Line items can only be changed on an unpaid or partially paid invoice", 409);
      }
      const ai = body.addItem as Record<string, unknown>;
      const name = typeof ai?.name === "string" ? ai.name.trim() : "";
      if (!name) return err("Validation failed", 422, { name: ["Item name is required"] });
      const quantity = Number(ai?.quantity ?? 1);
      const unitPrice = Number(ai?.unitPrice ?? 0);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return err("Validation failed", 422, { quantity: ["Quantity must be a whole number of at least 1"] });
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return err("Validation failed", 422, { unitPrice: ["Price must be non-negative"] });
      }
      const allowedTypes = ["SERVICE", "ADDON", "PACKAGE", "PRODUCT", "MISC"];
      const type = (typeof ai?.type === "string" && allowedTypes.includes(ai.type)) ? ai.type : "SERVICE";

      const taxPercent = await branchTaxPercent();
      const itemTotal = round2(unitPrice * quantity);
      const newItem = {
        invoiceId: id,
        type,
        name,
        quantity,
        unitPrice: round2(unitPrice),
        taxPercent,
        taxAmount: round2(itemTotal * (taxPercent / 100)),
        total: itemTotal,
      };

      const totals = recomputeExistingInvoice({
        invoice,
        items: [...invoice.items, newItem],
        discountAmount: Number(invoice.discountAmount),
        branchTaxPercent: taxPercent,
        netPaid,
      });
      if (isTotalsError(totals)) {
        return err("Validation failed", 422, { [totals.field]: [totals.error] });
      }

      const updated = await prisma.$transaction(async (tx) => {
        await claimInvoice(tx, id, invoice.updatedAt);
        await tx.invoiceItem.create({ data: newItem });
        await syncAppointment(tx, invoice.appointmentId, totals.paidAmount, totals.status);
        return tx.invoice.update({ where: { id }, data: totalsData(totals), include: { items: true } });
      });
      await writeAudit(user, {
        action: "UPDATE", module: "BILLING", refId: id, refType: "Invoice",
        newValue: { addedItem: name, totalAmount: totals.totalAmount } as Record<string, string | number | boolean | null>,
      });
      return ok(updated, "Item added");
    }

    // ── Bill correction: discount, line quantity / unit price, tip ─────────────
    // Two doors, one path. The original `discountAmount` request still works; the
    // edit form sends `edit: { discountAmount?, items?: [{ id, quantity?,
    // unitPrice? }], tipAmount? }`, optionally with `dryRun: true` for a preview.
    // Customer, payments, invoice number, date and GST rate are not editable here.
    const editBody =
      body.edit && typeof body.edit === "object" ? (body.edit as Record<string, unknown>) : null;
    const dryRun = body.dryRun === true;
    const currentTip = round2(
      invoice.items.filter((i) => i.type === "TIP").reduce((sum, i) => sum + Number(i.total), 0)
    );

    // What was asked for — validated before anything is computed.
    const discountInput = editBody && "discountAmount" in editBody ? editBody.discountAmount : body.discountAmount;
    const hasDiscount = (editBody ? "discountAmount" in editBody : false) || "discountAmount" in body;
    const newDiscount = hasDiscount ? Number(discountInput) : Number(invoice.discountAmount);
    if (hasDiscount && (!Number.isFinite(newDiscount) || newDiscount < 0)) {
      return err("Validation failed", 422, { discountAmount: ["Must be a non-negative number"] });
    }

    const hasTip = Boolean(editBody && "tipAmount" in editBody);
    const newTip = hasTip ? Number(editBody!.tipAmount) : currentTip;
    if (hasTip && (!Number.isFinite(newTip) || newTip < 0)) {
      return err("Validation failed", 422, { tipAmount: ["Tip must be a non-negative number"] });
    }

    const lineEdits = new Map<string, { quantity: number; unitPrice: number }>();
    if (editBody && "items" in editBody) {
      if (!Array.isArray(editBody.items)) {
        return err("Validation failed", 422, { items: ["items must be a list"] });
      }
      for (const raw of editBody.items as Record<string, unknown>[]) {
        const item = invoice.items.find((i) => i.id === raw?.id);
        if (!item) return err("Invoice item not found", 404);
        if (item.type === "TIP") {
          return err("Validation failed", 422, { items: ["Change the tip with tipAmount, not as a line"] });
        }
        const quantity = raw.quantity === undefined ? item.quantity : Number(raw.quantity);
        const unitPrice = raw.unitPrice === undefined ? Number(item.unitPrice) : Number(raw.unitPrice);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
          return err("Validation failed", 422, { quantity: [`${item.name}: quantity must be a whole number from 1 to 999`] });
        }
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          return err("Validation failed", 422, { unitPrice: [`${item.name}: price must be a non-negative number`] });
        }
        if (quantity !== item.quantity || round2(unitPrice) !== round2(Number(item.unitPrice))) {
          lineEdits.set(item.id, { quantity, unitPrice: round2(unitPrice) });
        }
      }
    }

    // An unchanged value (the edit form always sends the discount) is not a
    // change: re-deriving the same totals could only introduce rounding drift.
    const discountChanged = round2(newDiscount) !== round2(Number(invoice.discountAmount));
    const tipChanged = round2(newTip) !== currentTip;
    const figuresChanged = discountChanged || tipChanged || lineEdits.size > 0;

    if (figuresChanged || dryRun) {
      if (invoice.status !== "UNPAID" && invoice.status !== "PARTIAL" && invoice.status !== "PAID") {
        return err("A cancelled or refunded invoice cannot be changed", 409);
      }
      const canRefund = billingCapabilitiesFor(user.userType).canRefund;
      if (invoice.status === "PAID" && figuresChanged && !canRefund && !dryRun) {
        return err("Only a Branch Admin or higher can change the figures on a paid invoice", 403);
      }

      // The lines as they will be: edited quantity / price, and the tip as one
      // TIP line (dropped at ₹0). Untouched lines keep their stored values.
      const tipRow = invoice.items.find((i) => i.type === "TIP");
      const nextItems = [
        ...invoice.items
          .filter((i) => i.type !== "TIP")
          .map((i) => {
            const e = lineEdits.get(i.id);
            return e
              ? { ...i, quantity: e.quantity, unitPrice: e.unitPrice, total: round2(e.unitPrice * e.quantity) }
              : i;
          }),
        ...(round2(newTip) > 0
          ? [{ ...(tipRow ?? { id: "", type: "TIP", name: "Tip", quantity: 1 }), unitPrice: round2(newTip), total: round2(newTip) }]
          : []),
      ];

      const base = {
        invoice,
        items: nextItems,
        discountAmount: newDiscount,
        branchTaxPercent: await branchTaxPercent(),
      };
      // First the new total with nothing collected — rejects a discount above
      // the subtotal — then compare it with what the customer has paid.
      const fresh = recomputeExistingInvoice({ ...base, netPaid: 0 });
      if (isTotalsError(fresh)) {
        return err("Validation failed", 422, { [fresh.field]: [fresh.error] });
      }

      const excess = round2(netPaid - fresh.totalAmount);
      const needsRefund = excess >= EPSILON;
      // Once the excess is refunded the customer has paid exactly the new total.
      const totals = recomputeExistingInvoice({
        ...base,
        netPaid: needsRefund ? fresh.totalAmount : netPaid,
      });
      if (isTotalsError(totals)) {
        return err("Validation failed", 422, { [totals.field]: [totals.error] });
      }
      // A bill corrected to nothing whose money all went back is REFUNDED — the
      // refund route's rule (paid ≤ 0 after a refund ⇒ REFUNDED).
      const status: InvoiceStatus = needsRefund && totals.totalAmount <= 0 ? "REFUNDED" : totals.status;

      // Preview: the figures this edit would produce. Nothing is written.
      if (dryRun) {
        return ok(
          {
            ...totalsData(totals),
            status,
            tipAmount: totals.tipAmount,
            roundOff: totals.roundOff,
            refundRequired: needsRefund ? excess : 0,
            /** True when saving needs a role that may refund / change a paid bill. */
            requiresAdmin: !canRefund && (needsRefund || (invoice.status === "PAID" && figuresChanged)),
            changed: figuresChanged,
          },
          "Preview"
        );
      }

      let refundMethod: PaymentMethod | null = null;
      if (needsRefund) {
        if (!canRefund) {
          return err(
            `${inr(netPaid)} has already been collected, more than the new total of ${inr(fresh.totalAmount)}. ` +
              "Only a Branch Admin or higher can refund the difference.",
            403
          );
        }
        const refund = body.refund as { method?: unknown; amount?: unknown } | undefined;
        // The client must confirm THIS amount. A missing or different figure (the
        // bill changed since it asked) gets the current one back to confirm.
        if (!refund || Math.abs(Number(refund.amount) - excess) >= EPSILON) {
          return NextResponse.json(
            {
              success: false,
              message:
                `The new total is ${inr(fresh.totalAmount)} but ${inr(netPaid)} has already been collected. ` +
                `Confirm a refund of ${inr(excess)} to the customer to save this change.`,
              data: { refundRequired: excess, newTotal: fresh.totalAmount, paidAmount: netPaid },
            },
            { status: 409 }
          );
        }
        if (!REFUND_METHODS.includes(refund.method as PaymentMethod)) {
          return err("Validation failed", 422, { refundMethod: ["Choose how the refund is paid out"] });
        }
        refundMethod = refund.method as PaymentMethod;
      }

      const changes = [
        discountChanged && `discount ${inr(Number(invoice.discountAmount))} → ${inr(totals.discountAmount)}`,
        tipChanged && `tip ${inr(currentTip)} → ${inr(newTip)}`,
        ...[...lineEdits].map(([itemId, e]) => {
          const item = invoice.items.find((i) => i.id === itemId)!;
          return `${item.name} ${item.quantity} × ${inr(Number(item.unitPrice))} → ${e.quantity} × ${inr(e.unitPrice)}`;
        }),
      ].filter(Boolean) as string[];
      const reason = `Bill corrected on ${invoice.invoiceNo}: ${changes.join("; ")}`;

      const updated = await prisma.$transaction(async (tx) => {
        await claimInvoice(tx, id, invoice.updatedAt);

        for (const [itemId, e] of lineEdits) {
          const item = invoice.items.find((i) => i.id === itemId)!;
          const total = round2(e.unitPrice * e.quantity);
          await tx.invoiceItem.update({
            where: { id: itemId },
            data: {
              quantity: e.quantity,
              unitPrice: e.unitPrice,
              total,
              taxAmount: round2(total * (Number(item.taxPercent) / 100)),
            },
          });
          // A retail product's stock follows its corrected quantity — the bill
          // took `quantity` off the shelf when it was raised (billing/blank).
          const delta = item.quantity - e.quantity;
          if (item.type === "PRODUCT" && item.refId && delta !== 0) {
            await applyStockMovement(tx, {
              productId: item.refId,
              branchId: invoice.branchId,
              delta,
              type: "RETAIL_SALE",
              performedBy: user.userId,
              refId: id,
              notes: `Bill ${invoice.invoiceNo} corrected: quantity ${item.quantity} → ${e.quantity}`,
            });
          }
        }

        if (tipChanged) {
          if (round2(newTip) <= 0) {
            await tx.invoiceItem.deleteMany({ where: { invoiceId: id, type: "TIP" } });
          } else if (tipRow) {
            await tx.invoiceItem.update({
              where: { id: tipRow.id },
              data: { unitPrice: round2(newTip), total: round2(newTip), quantity: 1 },
            });
          } else {
            await tx.invoiceItem.create({
              data: { invoiceId: id, type: "TIP", name: "Tip", quantity: 1, unitPrice: round2(newTip), total: round2(newTip) },
            });
          }
        }

        if (needsRefund && refundMethod) {
          await tx.refund.create({
            data: {
              invoiceId: id,
              amount: excess,
              reason,
              method: refundMethod,
              processedBy: user.userId,
              notes: "Excess over the corrected total, refunded on a bill edit",
            },
          });
          if (refundMethod === "WALLET") {
            await creditWallet(tx, invoice.customerId, excess, "REFUND", {
              refId: id,
              description: `Refund on invoice ${invoice.invoiceNo} (bill corrected)`,
            });
          }
          // The payment route adds collected money to lifetime spend; money
          // handed back comes off it again. Floored at 0: not every path that
          // takes money (e.g. an appointment advance) added to it.
          const customer = await tx.customer.findUnique({
            where: { id: invoice.customerId },
            select: { totalSpend: true },
          });
          if (customer) {
            await tx.customer.update({
              where: { id: invoice.customerId },
              data: { totalSpend: Math.max(0, round2(Number(customer.totalSpend) - excess)) },
            });
          }
        }

        await syncAppointment(tx, invoice.appointmentId, totals.paidAmount, status);
        return tx.invoice.update({
          where: { id },
          data: { ...updates, ...totalsData(totals), status },
          include: { items: true },
        });
      });

      await writeAudit(user, {
        action: "UPDATE",
        module: "BILLING",
        refId: id,
        refType: "Invoice",
        oldValue: {
          subtotal: Number(invoice.subtotal),
          discountAmount: Number(invoice.discountAmount),
          tipAmount: currentTip,
          totalAmount: Number(invoice.totalAmount),
          paidAmount: netPaid,
          balanceDue: Number(invoice.balanceDue),
          status: invoice.status,
        },
        newValue: {
          ...updates,
          ...totalsData(totals),
          tipAmount: totals.tipAmount,
          status,
          changes: changes.join("; "),
          ...(needsRefund ? { refundAmount: excess, refundMethod } : {}),
        } as Record<string, string | number | boolean | null>,
      });

      return ok(
        updated,
        needsRefund
          ? `Bill updated — ${inr(excess)} refunded by ${METHOD_LABEL[refundMethod ?? ""] ?? refundMethod}`
          : "Invoice updated"
      );
    }

    if (Object.keys(updates).length === 0) {
      return err("No valid fields to update", 422);
    }

    const updated = await prisma.invoice.update({ where: { id }, data: updates });
    await writeAudit(user, {
      action: "UPDATE",
      module: "BILLING",
      refId: id,
      refType: "Invoice",
      newValue: updates as Record<string, string | number | boolean | null>,
    });
    return ok(updated, "Invoice updated");
  } catch (e) {
    if (e instanceof StaleInvoiceError) {
      return err("This invoice changed while you were editing it — reload and try again", 409);
    }
    if (e instanceof InsufficientStockError) {
      return err(`Not enough stock for the higher quantity (${e.available} left) — nothing was changed`, 409);
    }
    return err("Internal server error", 500);
  }
}
