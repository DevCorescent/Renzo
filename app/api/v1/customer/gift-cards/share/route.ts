// ============================================================================
// OWNER  : Gauransh
// MODULE : Customer Gift Cards — share / transfer
// ROUTE  : /api/v1/customer/gift-cards/share
//
// METHOD : POST { code, recipientCustomerId }
//   Transfer ownership of a gift card to ANOTHER registered customer, identified by
//   the existing GiftCard.code. Only the CURRENT owner may transfer.
//
//   • Backend interaction: looks the card up by its code (never by DB id), updates
//     ONLY the existing `ownedBy` field. `purchasedBy` is immutable — the original
//     buyer is preserved. Reuses AuditLog + NotificationLog; no schema change.
//   • Validation: card exists · caller is the current owner · card is ACTIVE ·
//     recipient is a registered customer · recipient ≠ current owner.
//   • Business flow: sharing to a NON-registered recipient is purely client-side
//     (share the code via WhatsApp/SMS/etc) and does not hit this route.
//   • Error handling: every failure returns a clear message; nothing is mutated.
// ACCESS : CUSTOMER (the owner).
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { logNotification } from "@/lib/notification-log";
import prisma from "@/lib/db";

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;
  if (!user.customerId) return err("Customer profile not found", 403);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const code: string = typeof body.code === "string" ? body.code.trim() : "";
    // Recipient identified by customerId OR phone (phone is resolved to a registered
    // customer — the customer-friendly path).
    const recipientCustomerId: string = typeof body.recipientCustomerId === "string" ? body.recipientCustomerId.trim() : "";
    const recipientPhone: string = typeof body.recipientPhone === "string" ? body.recipientPhone.trim() : "";
    const errors: Record<string, string[]> = {};
    if (!code) errors.code = ["Gift card code is required"];
    if (!recipientCustomerId && !recipientPhone) errors.recipient = ["A recipient customer or phone is required"];
    if (Object.keys(errors).length) return err("Validation failed", 422, errors);

    // Look up strictly by the code (the single customer-facing identifier).
    const card = await prisma.giftCard.findUnique({ where: { code } });
    if (!card) return err("Gift card not found", 404);

    // Only the current owner may transfer; the buyer alone cannot if they gave it away.
    if (card.ownedBy !== user.customerId) return err("Only the current owner can share this gift card", 403);
    if (card.status !== "ACTIVE") return err(`Cannot share a ${card.status.toLowerCase()} gift card`, 409);

    // Resolve the recipient to an existing registered customer. We NEVER create one —
    // an unregistered phone returns 404 so the caller can share the code externally.
    const recipient = recipientCustomerId
      ? await prisma.customer.findUnique({ where: { id: recipientCustomerId }, select: { id: true } })
      : await prisma.customer.findFirst({ where: { phone: recipientPhone }, select: { id: true } });
    if (!recipient) return err("Recipient is not a registered customer", 404);
    if (recipient.id === card.ownedBy) return err("The gift card already belongs to this customer", 409);

    // Transfer ONLY ownedBy; purchasedBy stays as the immutable original buyer.
    const updated = await prisma.giftCard.update({
      where: { id: card.id },
      data: { ownedBy: recipient.id },
    });

    // Audit the ownership change, then notify both parties (existing logs).
    await writeAudit(user, { action: "UPDATE", module: "GIFT_CARD", refId: card.id, refType: "GiftCard", oldValue: { ownedBy: card.ownedBy }, newValue: { ownedBy: recipient.id } });
    await logNotification({ customerId: user.customerId, trigger: "GIFT_CARD_SHARED", message: `You shared gift card ${card.code}.`, refId: card.id });
    await logNotification({ customerId: recipient.id, trigger: "GIFT_CARD_RECEIVED", message: `You received gift card ${card.code}.`, refId: card.id });

    return ok(updated, "Gift card shared");
  } catch {
    return err("Internal server error", 500);
  }
}
