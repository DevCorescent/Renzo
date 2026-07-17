// ============================================================================
// OWNER  : Gauransh
// MODULE : Gift Cards — redeem against an invoice
// ROUTE  : /api/v1/reception/billing/[id]/gift-card
//
// METHOD : POST { code }
//   Redeem a gift card (identified ONLY by its code) against an invoice at billing.
//   GiftCardRedemption requires an invoiceId, so redemption is invoice-bound — the
//   same pattern the coupon-apply route uses.
//
//   • Validation: invoice open · card exists (by code) · ACTIVE · balance > 0 · not
//     expired · owned by the invoice's customer (ownership rule).
//   • Business flow: redeem min(balance, amount due); atomically record the
//     GiftCardRedemption, reduce the card balance (→ REDEEMED at zero), and pay down
//     the invoice (→ PAID / PARTIAL). Reuses AuditLog + NotificationLog.
//   • Error handling: all-or-nothing in one transaction; a clear message on refusal.
// ACCESS : RECEPTIONIST, BRANCH_ADMIN, SUPER_ADMIN, OWNER.
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { logNotification } from "@/lib/notification-log";
import prisma from "@/lib/db";

const EPSILON = 0.01;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const code: string = typeof body.code === "string" ? body.code.trim() : "";
    if (!code) return err("Validation failed", 422, { code: ["Gift card code is required"] });

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return err("Invoice not found", 404);
    if (invoice.status === "CANCELLED") return err("Cannot apply a gift card to a cancelled invoice", 409);
    if (invoice.status === "PAID" || invoice.balanceDue <= EPSILON) return err("Invoice is already fully paid", 409);

    // Resolve strictly by the secure code, then run the redemption rules.
    const card = await prisma.giftCard.findUnique({ where: { code } });
    if (!card) return err("Gift card not found", 404);
    if (card.status !== "ACTIVE") return err(`Gift card is ${card.status.toLowerCase()}`, 409);
    if (card.balance <= EPSILON) return err("Gift card has no balance", 409);
    if (card.expiresAt && card.expiresAt.getTime() < Date.now()) return err("Gift card has expired", 409);
    // Ownership rule: the person being billed must currently own the card (transfer
    // ownership first via Share if it belongs to someone else).
    if (card.ownedBy !== invoice.customerId) return err("This gift card belongs to a different customer", 403);

    // Redeem the lesser of the remaining balance and the amount still due.
    const redeemAmount = Math.min(card.balance, invoice.balanceDue);
    const cardBalanceAfter = card.balance - redeemAmount;
    const invoiceDueAfter = invoice.balanceDue - redeemAmount;
    const fullyRedeemed = cardBalanceAfter <= EPSILON;

    // Atomic: record the redemption, adjust the card, pay down the invoice.
    const result = await prisma.$transaction(async (tx) => {
      await tx.giftCardRedemption.create({ data: { giftCardId: card.id, invoiceId: invoice.id, amount: redeemAmount } });
      const updatedCard = await tx.giftCard.update({
        where: { id: card.id },
        data: { balance: cardBalanceAfter, ...(fullyRedeemed ? { status: "REDEEMED" } : {}) },
      });
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: invoice.paidAmount + redeemAmount,
          balanceDue: invoiceDueAfter,
          status: invoiceDueAfter <= EPSILON ? "PAID" : "PARTIAL",
        },
      });
      return { updatedCard, updatedInvoice };
    });

    // Audit + notify the owner (and flag a fully-drained card).
    await writeAudit(user, { action: "REDEEM", module: "GIFT_CARD", refId: card.id, refType: "GiftCard", oldValue: { balance: card.balance }, newValue: { balance: cardBalanceAfter, redeemed: redeemAmount, invoiceId: invoice.id } });
    await logNotification({ customerId: card.ownedBy, trigger: "GIFT_CARD_REDEEMED", message: `₹${redeemAmount} redeemed from gift card ${card.code}.`, refId: card.id });
    if (fullyRedeemed) {
      await logNotification({ customerId: card.ownedBy, trigger: "GIFT_CARD_FULLY_REDEEMED", message: `Gift card ${card.code} is now fully redeemed.`, refId: card.id });
    }

    return ok(
      { giftCard: result.updatedCard, invoice: result.updatedInvoice, redeemed: redeemAmount },
      fullyRedeemed ? "Gift card fully redeemed" : "Gift card applied to invoice"
    );
  } catch {
    return err("Internal server error", 500);
  }
}
