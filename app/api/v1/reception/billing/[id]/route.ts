import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { computeInvoiceTotals, isTotalsError, round2 } from "@/lib/billing-service";
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
//   • discountAmount — only UNPAID / PARTIAL (recalculates totals)
//   • void (status → CANCELLED) — BRANCH_ADMIN / SUPER_ADMIN / OWNER only,
//     requires a voidReason
//
// A PAID invoice is intentionally immutable beyond notes. Discount changes
// on a paid bill would require a credit note / refund, not an in-place edit.
// ============================================================================
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER", "RECEPTIONIST");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true, payments: true },
    });
    if (!invoice) return err("Invoice not found", 404);

    const branchScoped = user.userType === "RECEPTIONIST" || user.userType === "BRANCH_ADMIN";
    if (branchScoped && user.branchId && invoice.branchId !== user.branchId) {
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

    // ── Remove a line item (UNPAID / PARTIAL only) ─────────────────────────
    if ("removeItemId" in body) {
      if (invoice.status !== "UNPAID" && invoice.status !== "PARTIAL") {
        return err("Line items can only be changed on an unpaid or partially paid invoice", 409);
      }
      const itemId = typeof body.removeItemId === "string" ? body.removeItemId : null;
      if (!itemId) return err("Validation failed", 422, { removeItemId: ["Item id is required"] });

      const item = invoice.items.find((i) => i.id === itemId);
      if (!item) return err("Invoice item not found", 404);
      if (invoice.items.filter((i) => i.type !== "TIP").length <= 1) {
        return err("Cannot remove the last service item — void the invoice instead", 409);
      }

      await prisma.invoiceItem.delete({ where: { id: itemId } });

      const remainingItems = invoice.items.filter((i) => i.id !== itemId && i.type !== "TIP");
      const taxSetting = await prisma.branchSetting.findUnique({
        where: { branchId: invoice.branchId },
        select: { taxPercent: true },
      });

      const totals = computeInvoiceTotals({
        lines: remainingItems.map((i) => ({
          type: i.type as "SERVICE" | "ADDON" | "PACKAGE" | "PRODUCT" | "MISC",
          refId: null,
          name: i.name,
          quantity: i.quantity,
          unitPrice: round2(Number(i.unitPrice)),
          total: round2(Number(i.unitPrice) * i.quantity),
        })),
        discountAmount: Number(invoice.discountAmount),
        taxPercent: Number(taxSetting?.taxPercent ?? 0),
        payments: invoice.payments.map((p) => ({ amount: Number(p.amount) })),
      });

      if (isTotalsError(totals)) {
        return err("Validation failed", 422, { [totals.field]: [totals.error] });
      }

      const updated = await prisma.invoice.update({
        where: { id },
        data: { ...totals },
        include: { items: true },
      });
      await writeAudit(user, {
        action: "UPDATE", module: "BILLING", refId: id, refType: "Invoice",
        newValue: { removedItemId: itemId } as Record<string, string | number | boolean | null>,
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
      if (!Number.isFinite(quantity) || quantity < 1) {
        return err("Validation failed", 422, { quantity: ["Quantity must be at least 1"] });
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return err("Validation failed", 422, { unitPrice: ["Price must be non-negative"] });
      }
      const allowedTypes = ["SERVICE", "ADDON", "PACKAGE", "PRODUCT", "MISC"];
      const type = (typeof ai?.type === "string" && allowedTypes.includes(ai.type)) ? ai.type : "SERVICE";

      const taxSetting = await prisma.branchSetting.findUnique({
        where: { branchId: invoice.branchId },
        select: { taxPercent: true },
      });
      const taxPercent = Number(taxSetting?.taxPercent ?? 0);
      const itemTotal = round2(unitPrice * quantity);
      const itemTaxAmount = round2(itemTotal * (taxPercent / 100));

      await prisma.invoiceItem.create({
        data: {
          invoiceId: id,
          type,
          name,
          quantity,
          unitPrice,
          taxPercent,
          taxAmount: itemTaxAmount,
          total: itemTotal,
        },
      });

      const allItems = [...invoice.items.filter((i) => i.type !== "TIP"), { type, name, quantity, unitPrice, total: itemTotal }];
      const totals = computeInvoiceTotals({
        lines: allItems.map((i) => ({
          type: i.type as "SERVICE" | "ADDON" | "PACKAGE" | "PRODUCT" | "MISC",
          refId: null,
          name: i.name,
          quantity: i.quantity,
          unitPrice: round2(Number(i.unitPrice)),
          total: round2(Number(i.unitPrice) * i.quantity),
        })),
        discountAmount: Number(invoice.discountAmount),
        taxPercent,
        payments: invoice.payments.map((p) => ({ amount: Number(p.amount) })),
      });

      if (isTotalsError(totals)) {
        return err("Validation failed", 422, { [totals.field]: [totals.error] });
      }

      const updated = await prisma.invoice.update({
        where: { id },
        data: { ...totals },
        include: { items: true },
      });
      await writeAudit(user, {
        action: "UPDATE", module: "BILLING", refId: id, refType: "Invoice",
        newValue: { addedItem: name } as Record<string, string | number | boolean | null>,
      });
      return ok(updated, "Item added");
    }

    // Discount — only for unpaid/partial invoices
    if ("discountAmount" in body) {
      if (invoice.status !== "UNPAID" && invoice.status !== "PARTIAL") {
        return err("Discount can only be changed on an unpaid or partially paid invoice", 409);
      }

      const newDiscount = Number(body.discountAmount);
      if (!Number.isFinite(newDiscount) || newDiscount < 0) {
        return err("Validation failed", 422, { discountAmount: ["Must be a non-negative number"] });
      }

      const taxSetting = await prisma.branchSetting.findUnique({
        where: { branchId: invoice.branchId },
        select: { taxPercent: true },
      });

      const lines = invoice.items
        .filter((item) => item.type !== "TIP")
        .map((item) => ({
          type: item.type as "SERVICE" | "ADDON" | "PACKAGE" | "PRODUCT" | "MISC",
          refId: null,
          name: item.name,
          quantity: item.quantity,
          unitPrice: round2(Number(item.unitPrice)),
          total: round2(Number(item.unitPrice) * item.quantity),
        }));

      const totals = computeInvoiceTotals({
        lines,
        discountAmount: newDiscount,
        taxPercent: Number(taxSetting?.taxPercent ?? 0),
        payments: invoice.payments.map((p) => ({ amount: Number(p.amount) })),
      });

      if (isTotalsError(totals)) {
        return err("Validation failed", 422, { [totals.field]: [totals.error] });
      }

      Object.assign(updates, {
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        paidAmount: totals.paidAmount,
        balanceDue: totals.balanceDue,
        status: totals.status,
      });
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
  } catch {
    return err("Internal server error", 500);
  }
}
