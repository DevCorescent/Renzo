import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { GiftCardStatus } from "@prisma/client";

const STATUSES: GiftCardStatus[] = ["ACTIVE", "REDEEMED", "EXPIRED", "CANCELLED"];

// OWNER: Shalmon | MODULE: Gift Cards
// GET /api/v1/admin/gift-cards/[id] — Detail with redemption history
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const giftCard = await prisma.giftCard.findUnique({
      where: { id },
      include: { redemptions: { orderBy: { redeemedAt: "desc" } } },
    });
    if (!giftCard) return err("Gift card not found", 404);
    return ok(giftCard);
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/gift-cards/[id] — Update status (e.g. cancel)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);
    if (!STATUSES.includes(body.status)) {
      return err("Validation failed", 422, { status: ["Invalid gift card status"] });
    }

    const existing = await prisma.giftCard.findUnique({ where: { id } });
    if (!existing) return err("Gift card not found", 404);

    const giftCard = await prisma.giftCard.update({
      where: { id },
      data: { status: body.status },
    });
    return ok(giftCard, "Gift card updated");
  } catch {
    return err("Internal server error", 500);
  }
}
