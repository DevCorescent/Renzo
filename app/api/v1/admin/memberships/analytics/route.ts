// ============================================================================
// OWNER  : Gauransh
// MODULE : Membership Analytics
// FLOW   : Aggregate the existing MembershipPlan / CustomerMembership records into
//          the six Super Admin summary cards. Nothing is stored — every figure is
//          computed live on request, so popularity is always current.
// ACCESS : SUPER_ADMIN, OWNER (same as the plan routes).
// BACKEND: Reuses MembershipPlan + CustomerMembership only; no new model, no
//          duplicate business logic.
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// Renewal window — an ACTIVE membership ending within this many days is "due".
const RENEWAL_WINDOW_DAYS = 30;

// GET /api/v1/admin/memberships/analytics
// Returns: totalPlans, activePlans, totalActiveMembers, totalRevenue,
//          mostPopularPlan (highest ACTIVE subscribers, computed dynamically),
//          renewalDue (ACTIVE memberships expiring within the window).
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + RENEWAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // All counts + the two group-bys run in parallel — no per-plan loop, no N+1.
    const [totalPlans, activePlans, totalActiveMembers, renewalDue, plans, allGroups, activeGroups] =
      await Promise.all([
        prisma.membershipPlan.count(),
        prisma.membershipPlan.count({ where: { isActive: true } }),
        prisma.customerMembership.count({ where: { status: "ACTIVE" } }),
        prisma.customerMembership.count({ where: { status: "ACTIVE", endDate: { gte: now, lte: windowEnd } } }),
        prisma.membershipPlan.findMany({ select: { id: true, name: true, price: true } }),
        // Every subscription (any status) per plan → gross revenue.
        prisma.customerMembership.groupBy({ by: ["planId"], _count: { _all: true } }),
        // ACTIVE subscriptions per plan → popularity + active totals.
        prisma.customerMembership.groupBy({ by: ["planId"], where: { status: "ACTIVE" }, _count: { _all: true } }),
      ]);

    const priceMap = new Map(plans.map((p) => [p.id, p.price]));
    const nameMap = new Map(plans.map((p) => [p.id, p.name]));

    // Gross membership revenue = Σ (subscriptions × plan price). CustomerMembership is
    // not related to Invoice in the schema, so this is the faithful figure.
    let totalRevenue = 0;
    for (const g of allGroups) totalRevenue += (priceMap.get(g.planId) ?? 0) * g._count._all;

    // Most popular = the plan with the most ACTIVE subscribers, resolved live.
    let mostPopularPlan: { id: string; name: string; activeMembers: number } | null = null;
    for (const g of activeGroups) {
      if (!mostPopularPlan || g._count._all > mostPopularPlan.activeMembers) {
        mostPopularPlan = { id: g.planId, name: nameMap.get(g.planId) ?? "—", activeMembers: g._count._all };
      }
    }

    return ok({
      totalPlans,
      activePlans,
      totalActiveMembers,
      totalRevenue,
      mostPopularPlan,
      renewalDue,
    });
  } catch {
    return err("Internal server error", 500);
  }
}
