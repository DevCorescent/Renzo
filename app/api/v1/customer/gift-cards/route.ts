import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { logNotification } from "@/lib/notification-log";
import prisma from "@/lib/db";
import { genGiftCardCode } from "@/lib/codes";

// OWNER: Shalmon | MODULE: Customer Gift Cards
// GET /api/v1/customer/gift-cards — Cards this customer bought or owns
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;
  if (!user.customerId) return err("Customer profile not found", 403);

  try {
    const { page, limit, skip } = parsePagination(new URL(req.url));
    const where = {
      OR: [{ ownedBy: user.customerId }, { purchasedBy: user.customerId }],
    };

    const [items, total] = await Promise.all([
      prisma.giftCard.findMany({
        where,
        skip,
        take: limit,
        orderBy: { purchasedAt: "desc" },
        include: { redemptions: { orderBy: { redeemedAt: "desc" } } },
      }),
      prisma.giftCard.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/customer/gift-cards — Buy a digital gift card
// Body: { value, recipientName?, recipientPhone?, giftMessage?, expiresAt? }
//
// Real flow: create a Razorpay order, then issue the card from the verified
// payment webhook. Razorpay isn't wired yet, so outside production we issue
// directly to unblock testing; production refuses rather than giving it away.
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;
  if (!user.customerId) return err("Customer profile not found", 403);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0) {
      return err("Validation failed", 422, { value: ["value must be a positive number"] });
    }

    if (process.env.NODE_ENV === "production") {
      return err("Payment gateway not configured — gift card purchase unavailable", 503);
    }

    const base = {
      type: "DIGITAL" as const,
      value,
      balance: value,
      purchasedBy: user.customerId,
      ownedBy: user.customerId, // purchaser owns it until shared/transferred
      recipientName: typeof body.recipientName === "string" ? body.recipientName : null,
      recipientPhone: typeof body.recipientPhone === "string" ? body.recipientPhone : null,
      giftMessage: typeof body.giftMessage === "string" ? body.giftMessage : null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    };

    // Generate a secure GiftCard.code (the redemption token). On the astronomically
    // rare unique-collision (P2002) we regenerate and retry; we NEVER reuse or mutate
    // an already-issued code.
    let giftCard = null;
    for (let attempt = 0; attempt < 5 && !giftCard; attempt++) {
      try {
        giftCard = await prisma.giftCard.create({ data: { ...base, code: genGiftCardCode() } });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
        throw e;
      }
    }
    if (!giftCard) return err("Could not issue a unique gift card code, please retry", 409);

    // Audit + notify the purchaser (reuse AuditLog / NotificationLog).
    await writeAudit(user, { action: "CREATE", module: "GIFT_CARD", refId: giftCard.id, refType: "GiftCard", newValue: { code: giftCard.code, value } });
    await logNotification({ customerId: user.customerId, trigger: "GIFT_CARD_PURCHASED", message: `Gift card ${giftCard.code} for ₹${value} purchased.`, refId: giftCard.id });

    return created(giftCard, "Gift card purchased");
  } catch {
    return err("Internal server error", 500);
  }
}
