import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { MembershipTier, Prisma } from "@prisma/client";

const TIERS: MembershipTier[] = ["SILVER", "GOLD", "PLATINUM", "CUSTOM"];

// OWNER: Shalmon | MODULE: Membership Plans
// GET /api/v1/admin/memberships/plans — List plans with benefits + per-plan stats.
//
// Backend-driven search/filters (all optional, additive — no param = original
// behaviour): search (name), tier, isActive, minPrice/maxPrice, minValidity/
// maxValidity. Each returned plan is enriched with totalMembers (all subscriptions),
// activeMembers (status ACTIVE) and revenue (members × price) so the table renders
// without extra round trips. ACCESS: SUPER_ADMIN, OWNER.
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);

    // Optional filters, each applied only when present so the default listing is
    // unchanged for existing callers.
    const tier = url.searchParams.get("tier");
    const isActiveParam = url.searchParams.get("isActive");

    // Parse a numeric range param ONLY when it is actually present. `searchParams.get`
    // returns null for an absent param and Number(null) === 0 (finite!), so the old
    // `Number(get(...))` coerced a missing maxPrice/maxValidity into 0 and applied
    // `lte: 0` — which excluded every real plan and made the table read "0 plans"
    // even though plans exist. Returning undefined for absent/blank leaves the filter
    // off entirely.
    const numParam = (key: string): number | undefined => {
      const raw = url.searchParams.get(key);
      if (raw === null || raw.trim() === "") return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    };
    const minPrice = numParam("minPrice");
    const maxPrice = numParam("maxPrice");
    const minValidity = numParam("minValidity");
    const maxValidity = numParam("maxValidity");

    const priceFilter: Prisma.FloatFilter = {};
    if (minPrice !== undefined) priceFilter.gte = minPrice;
    if (maxPrice !== undefined) priceFilter.lte = maxPrice;
    const validityFilter: Prisma.IntFilter = {};
    if (minValidity !== undefined) validityFilter.gte = minValidity;
    if (maxValidity !== undefined) validityFilter.lte = maxValidity;

    const where: Prisma.MembershipPlanWhereInput = {
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(tier && TIERS.includes(tier as MembershipTier) ? { tier: tier as MembershipTier } : {}),
      ...(isActiveParam === "true" ? { isActive: true } : {}),
      ...(isActiveParam === "false" ? { isActive: false } : {}),
      ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
      ...(Object.keys(validityFilter).length ? { validityDays: validityFilter } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.membershipPlan.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
        include: { benefits: true, _count: { select: { customers: true } } },
      }),
      prisma.membershipPlan.count({ where }),
    ]);

    // ACTIVE subscriber count per plan on THIS page — one grouped query (no N+1),
    // used for the "active members" column and the popularity signal.
    const planIds = items.map((p) => p.id);
    const activeGroups = planIds.length
      ? await prisma.customerMembership.groupBy({
          by: ["planId"],
          where: { planId: { in: planIds }, status: "ACTIVE" },
          _count: { _all: true },
        })
      : [];
    const activeMap = new Map(activeGroups.map((g) => [g.planId, g._count._all]));

    // Derived per-plan stats — revenue is gross plan sales (members × price); the
    // schema does not relate CustomerMembership to Invoice, so this is the faithful
    // figure without an unsupported join.
    const withStats = items.map((p) => ({
      ...p,
      totalMembers: p._count.customers,
      activeMembers: activeMap.get(p.id) ?? 0,
      revenue: p._count.customers * p.price,
    }));

    return paginated(withStats, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/memberships/plans — Create a plan (+ optional benefits)
export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const name: string = typeof body.name === "string" ? body.name.trim() : "";
    const price = Number(body.price);
    const validityDays = Number(body.validityDays);
    const errors: Record<string, string[]> = {};
    if (!name) errors.name = ["Name is required"];
    if (!TIERS.includes(body.tier)) errors.tier = ["Invalid tier"];
    if (!Number.isFinite(price) || price < 0) errors.price = ["price must be a non-negative number"];
    if (!Number.isInteger(validityDays) || validityDays <= 0) errors.validityDays = ["validityDays must be a positive integer"];
    if (Object.keys(errors).length) return err("Validation failed", 422, errors);

    const benefits = Array.isArray(body.benefits)
      ? body.benefits
          .filter((b: unknown): b is { name: string; value: string } =>
            !!b && typeof b === "object" && typeof (b as { name?: unknown }).name === "string")
          .map((b: { name: string; value?: string }) => ({ name: b.name, value: String(b.value ?? "") }))
      : [];

    const plan = await prisma.membershipPlan.create({
      data: {
        name,
        tier: body.tier,
        price,
        validityDays,
        description: typeof body.description === "string" ? body.description : null,
        discountPercent: Number(body.discountPercent) || 0,
        walletCredit: Number(body.walletCredit) || 0,
        freeServices: body.freeServices ?? undefined,
        priorityBooking: body.priorityBooking === true,
        branchAccess: typeof body.branchAccess === "string" ? body.branchAccess : "ALL",
        isActive: body.isActive !== false,
        sortOrder: Number(body.sortOrder) || 0,
        ...(benefits.length ? { benefits: { create: benefits } } : {}),
      },
      include: { benefits: true },
    });
    return created(plan, "Membership plan created");
  } catch {
    return err("Internal server error", 500);
  }
}
