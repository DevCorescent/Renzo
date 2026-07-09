import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { getOrCreateLoyaltyAccount, getLoyaltyConfig } from "@/lib/loyalty";

// OWNER: Shalmon | MODULE: Customer Loyalty Account
// GET /api/v1/customer/loyalty — Tier, points, and recent transactions
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;
  if (!user.customerId) return err("Customer profile not found", 403);

  try {
    const [account, config] = await Promise.all([
      getOrCreateLoyaltyAccount(prisma, user.customerId),
      getLoyaltyConfig(prisma),
    ]);

    const transactions = await prisma.loyaltyTransaction.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return ok({
      tier: account.tier,
      totalPoints: account.totalPoints,
      availablePoints: account.availablePoints,
      lifetimeEarned: account.lifetimeEarned,
      lifetimeRedeemed: account.lifetimeRedeemed,
      // What the available points are actually worth, and the rules.
      redeemableValue: Number((account.availablePoints * config.redemptionValue).toFixed(2)),
      minRedemption: config.minRedemption,
      redemptionValue: config.redemptionValue,
      maxRedemptionPct: config.maxRedemptionPct,
      transactions,
    });
  } catch {
    return err("Internal server error", 500);
  }
}
