import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { genCode } from "@/lib/codes";
import type { GiftCardType, GiftCardStatus, Prisma } from "@prisma/client";

const TYPES: GiftCardType[] = ["DIGITAL", "PHYSICAL"];

// OWNER: Shalmon | MODULE: Gift Cards
// GET /api/v1/admin/gift-cards — List gift cards (filter by status)
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);
    const status = url.searchParams.get("status");

    const where: Prisma.GiftCardWhereInput = {
      ...(status ? { status: status as GiftCardStatus } : {}),
      ...(search ? { code: { contains: search, mode: "insensitive" } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.giftCard.findMany({ where, skip, take: limit, orderBy: { purchasedAt: "desc" } }),
      prisma.giftCard.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/gift-cards — Issue a gift card
export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
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

    const giftCard = await prisma.giftCard.create({
      data: {
        code: genCode("GC"),
        type: TYPES.includes(body.type) ? body.type : "DIGITAL",
        value,
        balance: value,
        purchasedBy,
        ownedBy: typeof body.ownedBy === "string" ? body.ownedBy : purchasedBy,
        recipientName: typeof body.recipientName === "string" ? body.recipientName : null,
        recipientPhone: typeof body.recipientPhone === "string" ? body.recipientPhone : null,
        giftMessage: typeof body.giftMessage === "string" ? body.giftMessage : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });
    return created(giftCard, "Gift card issued");
  } catch {
    return err("Internal server error", 500);
  }
}
