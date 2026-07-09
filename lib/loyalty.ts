import type { Prisma, LoyaltyTier } from "@prisma/client";

// OWNER: Shalmon | MODULE: Loyalty — config, account, earning & tiers

type Db = Prisma.TransactionClient;

export type LoyaltyConfigLike = {
  pointsPerRupee: number;
  redemptionValue: number; // ₹ per point
  minRedemption: number;
  maxRedemptionPct: number; // max % of a bill payable via points
  pointExpireDays: number | null;
  bronzeMin: number;
  silverMin: number;
  goldMin: number;
  diamondMin: number;
};

// Mirrors the LoyaltyConfig schema defaults, used when no config row exists yet.
export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfigLike = {
  pointsPerRupee: 1,
  redemptionValue: 0.25,
  minRedemption: 100,
  maxRedemptionPct: 50,
  pointExpireDays: null,
  bronzeMin: 0,
  silverMin: 1000,
  goldMin: 5000,
  diamondMin: 15000,
};

export async function getLoyaltyConfig(db: Db): Promise<LoyaltyConfigLike> {
  const cfg = await db.loyaltyConfig.findFirst({ where: { isActive: true } });
  return cfg ?? DEFAULT_LOYALTY_CONFIG;
}

export async function getOrCreateLoyaltyAccount(db: Db, customerId: string) {
  const existing = await db.loyaltyAccount.findUnique({ where: { customerId } });
  return existing ?? db.loyaltyAccount.create({ data: { customerId } });
}

// Tier is derived from lifetime earned points — it never drops when points
// are spent.
export function tierFor(lifetimeEarned: number, cfg: LoyaltyConfigLike): LoyaltyTier {
  if (lifetimeEarned >= cfg.diamondMin) return "DIAMOND";
  if (lifetimeEarned >= cfg.goldMin) return "GOLD";
  if (lifetimeEarned >= cfg.silverMin) return "SILVER";
  return "BRONZE";
}

// Award points for money actually spent. Call this when a payment is recorded.
// Returns null when the amount is too small to earn a whole point.
export async function earnLoyaltyPoints(
  tx: Db,
  customerId: string,
  amountPaid: number,
  opts: { refId?: string; description?: string } = {}
) {
  const cfg = await getLoyaltyConfig(tx);
  const points = Math.floor(amountPaid * cfg.pointsPerRupee);
  if (points <= 0) return null;

  const account = await getOrCreateLoyaltyAccount(tx, customerId);
  const balanceBefore = account.availablePoints;
  const balanceAfter = balanceBefore + points;
  const lifetimeEarned = account.lifetimeEarned + points;

  const updated = await tx.loyaltyAccount.update({
    where: { id: account.id },
    data: {
      availablePoints: balanceAfter,
      totalPoints: account.totalPoints + points,
      lifetimeEarned,
      tier: tierFor(lifetimeEarned, cfg),
    },
  });

  await tx.loyaltyTransaction.create({
    data: {
      accountId: account.id,
      type: "EARNED",
      points,
      balanceBefore,
      balanceAfter,
      refId: opts.refId ?? null,
      description: opts.description ?? null,
      expiresAt: cfg.pointExpireDays
        ? new Date(Date.now() + cfg.pointExpireDays * 24 * 60 * 60 * 1000)
        : null,
    },
  });

  return updated;
}
