import type { Prisma, GiftCard } from "@prisma/client";

// OWNER: Shalmon | MODULE: Gift Cards — redemption
// A gift card is "spent" by paying an invoice with it: balance goes down,
// a GiftCardRedemption row records where the value went.

type Db = Prisma.TransactionClient;

// Returns a human-readable reason the card can't be used, or null if it can.
export function giftCardUsableReason(
  card: GiftCard,
  amount: number,
  customerId: string
): string | null {
  if (card.status !== "ACTIVE") return `Gift card is ${card.status.toLowerCase()}`;
  if (card.expiresAt && card.expiresAt < new Date()) return "Gift card has expired";
  // Only the current owner may spend it (ownership can transfer after gifting).
  const owner = card.ownedBy ?? card.purchasedBy;
  if (owner !== customerId) return "Gift card belongs to another customer";
  if (card.balance < amount) return `Gift card balance is only ${card.balance.toFixed(2)}`;
  return null;
}

export async function redeemGiftCard(
  tx: Db,
  cardId: string,
  invoiceId: string,
  amount: number
) {
  const card = await tx.giftCard.findUnique({ where: { id: cardId } });
  if (!card) throw new Error("GIFT_CARD_NOT_FOUND");

  const balance = Number((card.balance - amount).toFixed(2));

  const updated = await tx.giftCard.update({
    where: { id: cardId },
    data: {
      balance,
      // A fully-drained card is spent for good.
      status: balance <= 0 ? "REDEEMED" : card.status,
    },
  });

  await tx.giftCardRedemption.create({
    data: { giftCardId: cardId, invoiceId, amount },
  });

  return updated;
}
