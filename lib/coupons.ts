import type { Prisma, Coupon } from "@prisma/client";

// OWNER: Shalmon | MODULE: Coupons — validation + discount maths

type Db = Prisma.TransactionClient;

// FLAT = rupees off. PERCENTAGE = % of the order, optionally capped by
// maxDiscount. Never discount more than the order itself.
export function computeCouponDiscount(coupon: Coupon, orderAmount: number): number {
  const raw =
    coupon.type === "FLAT"
      ? coupon.value
      : (orderAmount * coupon.value) / 100;

  const capped =
    coupon.type === "PERCENTAGE" && coupon.maxDiscount != null
      ? Math.min(raw, coupon.maxDiscount)
      : raw;

  return Number(Math.min(capped, orderAmount).toFixed(2));
}

// Returns a human-readable reason the coupon can't be used, or null if it can.
export async function couponUnusableReason(
  db: Db,
  coupon: Coupon,
  customerId: string,
  orderAmount: number
): Promise<string | null> {
  const now = new Date();

  if (!coupon.isActive) return "Coupon is inactive";
  if (coupon.validFrom > now) return "Coupon is not yet valid";
  if (coupon.validUntil && coupon.validUntil < now) return "Coupon has expired";
  if (orderAmount < coupon.minOrderAmount) {
    return `Order must be at least ${coupon.minOrderAmount} to use this coupon`;
  }
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return "Coupon usage limit reached";
  }

  const usedByCustomer = await db.couponUsage.count({
    where: { couponId: coupon.id, customerId },
  });
  if (usedByCustomer >= coupon.usageLimitPerCustomer) {
    return "You have already used this coupon the maximum number of times";
  }

  return null;
}
