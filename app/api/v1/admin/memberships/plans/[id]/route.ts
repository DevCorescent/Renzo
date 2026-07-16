import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Membership Plans
// GET /api/v1/admin/memberships/plans/[id] — Plan with benefits + subscriber stats.
//
// Additively enriched with a `stats` block (status breakdown, revenue, renewals due,
// latest purchase) for the plan detail drawer — computed live from the existing
// CustomerMembership records via a single grouped query (no N+1). The plan fields
// remain at the top level, so any existing consumer is unaffected.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const plan = await prisma.membershipPlan.findUnique({
      where: { id },
      include: { benefits: true, _count: { select: { customers: true } } },
    });
    if (!plan) return err("Plan not found", 404);

    const now = new Date();
    const windowEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // One grouped status count + renewals-due + latest purchase, all for this plan.
    const [statusGroups, renewalsDue, latest] = await Promise.all([
      prisma.customerMembership.groupBy({ by: ["status"], where: { planId: id }, _count: { _all: true } }),
      prisma.customerMembership.count({ where: { planId: id, status: "ACTIVE", endDate: { gte: now, lte: windowEnd } } }),
      prisma.customerMembership.findFirst({ where: { planId: id }, orderBy: { purchasedAt: "desc" }, select: { purchasedAt: true } }),
    ]);

    const byStatus = { ACTIVE: 0, FROZEN: 0, EXPIRED: 0, CANCELLED: 0 };
    let total = 0;
    for (const g of statusGroups) {
      total += g._count._all;
      byStatus[g.status] = g._count._all;
    }

    const stats = {
      total,
      active: byStatus.ACTIVE,
      frozen: byStatus.FROZEN,
      expired: byStatus.EXPIRED,
      cancelled: byStatus.CANCELLED,
      revenue: total * plan.price, // gross plan sales (schema has no membership→invoice link)
      renewalsDue,
      latestPurchase: latest?.purchasedAt ?? null,
    };

    return ok({ ...plan, stats });
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/memberships/plans/[id] — Update plan (replaces benefits if provided)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const existing = await prisma.membershipPlan.findUnique({ where: { id } });
    if (!existing) return err("Plan not found", 404);

    const plan = await prisma.$transaction(async (tx) => {
      // If benefits array is provided, replace the whole set.
      if (Array.isArray(body.benefits)) {
        await tx.membershipBenefit.deleteMany({ where: { planId: id } });
        const benefits = body.benefits
          .filter((b: unknown): b is { name: string; value?: string } =>
            !!b && typeof b === "object" && typeof (b as { name?: unknown }).name === "string")
          .map((b: { name: string; value?: string }) => ({ planId: id, name: b.name, value: String(b.value ?? "") }));
        if (benefits.length) await tx.membershipBenefit.createMany({ data: benefits });
      }
      return tx.membershipPlan.update({
        where: { id },
        data: {
          ...(typeof body.name === "string" ? { name: body.name } : {}),
          ...(body.price != null ? { price: Number(body.price) } : {}),
          ...(body.validityDays != null ? { validityDays: Number(body.validityDays) } : {}),
          ...(typeof body.description === "string" ? { description: body.description } : {}),
          ...(body.discountPercent != null ? { discountPercent: Number(body.discountPercent) } : {}),
          ...(body.walletCredit != null ? { walletCredit: Number(body.walletCredit) } : {}),
          ...(typeof body.priorityBooking === "boolean" ? { priorityBooking: body.priorityBooking } : {}),
          ...(body.sortOrder != null ? { sortOrder: Number(body.sortOrder) } : {}),
          ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
        },
        include: { benefits: true },
      });
    });
    return ok(plan, "Plan updated");
  } catch {
    return err("Internal server error", 500);
  }
}

// DELETE /api/v1/admin/memberships/plans/[id] — Deactivate (blocked if active subscribers)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const existing = await prisma.membershipPlan.findUnique({ where: { id } });
    if (!existing) return err("Plan not found", 404);

    const activeSubs = await prisma.customerMembership.count({
      where: { planId: id, status: "ACTIVE" },
    });
    if (activeSubs > 0) {
      return err(`Cannot deactivate — ${activeSubs} active subscriber(s)`, 409);
    }

    await prisma.membershipPlan.update({ where: { id }, data: { isActive: false } });
    return ok(null, "Plan deactivated");
  } catch {
    return err("Internal server error", 500);
  }
}
