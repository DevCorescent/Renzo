import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { genCode } from "@/lib/codes";

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

    const giftCard = await prisma.giftCard.create({
      data: {
        code: genCode("GC"),
        type: "DIGITAL",
        value,
        balance: value,
        purchasedBy: user.customerId,
        ownedBy: user.customerId,
        recipientName: typeof body.recipientName === "string" ? body.recipientName : null,
        recipientPhone: typeof body.recipientPhone === "string" ? body.recipientPhone : null,
        giftMessage: typeof body.giftMessage === "string" ? body.giftMessage : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });

    return created(giftCard, "Gift card purchased");
  } catch {
    return err("Internal server error", 500);
  }
}
