// ============================================================================
// OWNER  : Gauransh
// MODULE : Gift Card Analytics
// PURPOSE: Aggregate the existing GiftCard + GiftCardRedemption records into the
//          Marketing summary cards. Computed live — nothing stored, no new column.
// BACKEND: Reuses GiftCard + GiftCardRedemption only; no duplicate logic.
// ACCESS : SUPER_ADMIN, OWNER, BRANCH_ADMIN, MARKETING_MANAGER (as the GC routes).
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// GET /api/v1/admin/gift-cards/analytics
// Returns: totalGiftCards, activeGiftCards, purchasedByCustomers (DISTINCT
//          purchasers), redeemedCards (cards that have >= 1 redemption).
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const [total, active, purchasers, redeemedCardGroups] = await Promise.all([
      prisma.giftCard.count(),
      prisma.giftCard.count({ where: { status: "ACTIVE" } }),
      // DISTINCT customers who have purchased a gift card.
      prisma.giftCard.findMany({ select: { purchasedBy: true }, distinct: ["purchasedBy"] }),
      // Cards that have been redeemed at least once (GiftCardRedemption has no
      // customer column, so redemption is measured per card, grouped by giftCardId).
      prisma.giftCardRedemption.groupBy({ by: ["giftCardId"], _count: { _all: true } }),
    ]);

    return ok({
      totalGiftCards: total,
      activeGiftCards: active,
      purchasedByCustomers: purchasers.length,
      redeemedCards: redeemedCardGroups.length,
    });
  } catch {
    return err("Internal server error", 500);
  }
}
