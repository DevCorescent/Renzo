import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { logNotification } from "@/lib/notification-log";
import prisma from "@/lib/db";
import { genGiftCardCode } from "@/lib/codes";
import { Prisma } from "@prisma/client";
import type { GiftCardType, GiftCardStatus } from "@prisma/client";

const TYPES: GiftCardType[] = ["DIGITAL", "PHYSICAL"];

// OWNER: Shalmon | MODULE: Gift Cards
// GET /api/v1/admin/gift-cards — List gift cards (filter by status / type, search code).
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN, MARKETING_MANAGER (marketing manages the
// gift-card catalogue alongside coupons/campaigns).
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");

    const where: Prisma.GiftCardWhereInput = {
      ...(status ? { status: status as GiftCardStatus } : {}),
      ...(type && TYPES.includes(type as GiftCardType) ? { type: type as GiftCardType } : {}),
      ...(search ? { code: { contains: search, mode: "insensitive" } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.giftCard.findMany({
        where,
        skip,
        take: limit,
        orderBy: { purchasedAt: "desc" },
        include: {
          // Redemption count per card (the "redemptions" column) + current owner name.
          _count: { select: { redemptions: true } },
          owner: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.giftCard.count({ where }),
    ]);

    // `purchasedBy` is a raw customerId (no relation on the model), so resolve the
    // purchaser names in one grouped read for this page — no N+1.
    const purchaserIds = [...new Set(items.map((g) => g.purchasedBy))];
    const purchasers = purchaserIds.length
      ? await prisma.customer.findMany({ where: { id: { in: purchaserIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const nameOf = new Map(purchasers.map((c) => [c.id, `${c.firstName} ${c.lastName ?? ""}`.trim()]));

    const withNames = items.map((g) => ({
      ...g,
      purchasedByName: nameOf.get(g.purchasedBy) ?? null,
      ownerName: g.owner ? `${g.owner.firstName} ${g.owner.lastName ?? ""}`.trim() : null,
    }));
    return paginated(withNames, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/gift-cards — Issue a gift card. ACCESS adds MARKETING_MANAGER.
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const value = Number(body.value);
    const purchasedBy: string = typeof body.purchasedBy === "string" ? body.purchasedBy : "";
    const errors: Record<string, string[]> = {};
    if (!Number.isFinite(value) || value <= 0) errors.value = ["value must be a positive number"];
    if (!purchasedBy) errors.purchasedBy = ["purchasedBy (customerId) is required"];
    if (Object.keys(errors).length) return err("Validation failed", 422, errors);

    const base = {
      type: TYPES.includes(body.type) ? (body.type as (typeof TYPES)[number]) : "DIGITAL",
      value,
      balance: value,
      purchasedBy,
      ownedBy: typeof body.ownedBy === "string" ? body.ownedBy : purchasedBy,
      recipientName: typeof body.recipientName === "string" ? body.recipientName : null,
      recipientPhone: typeof body.recipientPhone === "string" ? body.recipientPhone : null,
      giftMessage: typeof body.giftMessage === "string" ? body.giftMessage : null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    };

    // Secure GiftCard.code (redemption token) with a collision retry on the unique
    // constraint. An issued code is never reused or regenerated afterwards.
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

    await writeAudit(user, { action: "CREATE", module: "GIFT_CARD", refId: giftCard.id, refType: "GiftCard", newValue: { code: giftCard.code, value: giftCard.value } });
    await logNotification({ customerId: purchasedBy, trigger: "GIFT_CARD_PURCHASED", message: `Gift card ${giftCard.code} for ₹${value} issued.`, refId: giftCard.id });
    return created(giftCard, "Gift card issued");
  } catch {
    return err("Internal server error", 500);
  }
}
