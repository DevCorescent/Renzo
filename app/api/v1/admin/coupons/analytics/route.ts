// ============================================================================
// OWNER  : Gauransh
// MODULE : Coupon Analytics
// PURPOSE: Aggregate the existing Coupon + CouponUsage records into the Super Admin
//          coupon summary cards. Every figure is computed live on request from the
//          real fields (isActive / validFrom / validUntil / usedCount / usageLimit
//          and CouponUsage.discountAmount) — nothing is stored, no new column.
//
// BACKEND: Reuses Coupon + CouponUsage only; no new model, no duplicate logic.
// ACCESS : SUPER_ADMIN, OWNER, MARKETING_MANAGER (same as the coupon routes).
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// GET /api/v1/admin/coupons/analytics
// Returns: totalCoupons, activeCoupons, expiredCoupons, upcomingCoupons,
//          couponsUsed (Σ usedCount), couponsRemaining (Σ remaining where limited),
//          totalDiscountGiven (Σ CouponUsage.discountAmount), mostUsedCoupon.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const now = new Date();

    const [total, active, expired, upcoming, usedAgg, discountAgg, mostUsed, limited, distinctCustomers] = await Promise.all([
      prisma.coupon.count(),
      prisma.coupon.count({ where: { isActive: true, validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gte: now } }] } }),
      prisma.coupon.count({ where: { isActive: true, validUntil: { lt: now } } }),
      prisma.coupon.count({ where: { isActive: true, validFrom: { gt: now } } }),
      prisma.coupon.aggregate({ _sum: { usedCount: true } }),
      prisma.couponUsage.aggregate({ _sum: { discountAmount: true } }),
      prisma.coupon.findFirst({ where: { usedCount: { gt: 0 } }, orderBy: { usedCount: "desc" }, select: { id: true, code: true, usedCount: true } }),
      // Only limited coupons contribute a finite "remaining" figure.
      prisma.coupon.findMany({ where: { usageLimit: { not: null } }, select: { usageLimit: true, usedCount: true } }),
      // DISTINCT customers who have ever used any coupon (the "customers used" card).
      prisma.couponUsage.findMany({ select: { customerId: true }, distinct: ["customerId"] }),
    ]);

    // Remaining redemptions across coupons that HAVE a usage limit (unlimited ones
    // are excluded — they have no finite remainder).
    let couponsRemaining = 0;
    for (const c of limited) couponsRemaining += Math.max(0, (c.usageLimit ?? 0) - c.usedCount);

    return ok({
      totalCoupons: total,
      activeCoupons: active,
      expiredCoupons: expired,
      upcomingCoupons: upcoming,
      couponsUsed: usedAgg._sum.usedCount ?? 0,
      couponsRemaining,
      totalDiscountGiven: discountAgg._sum.discountAmount ?? 0,
      totalCustomersUsed: distinctCustomers.length,
      mostUsedCoupon: mostUsed ? { code: mostUsed.code, usedCount: mostUsed.usedCount } : null,
    });
  } catch {
    return err("Internal server error", 500);
  }
}
