import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { MembershipTier } from "@prisma/client";

const TIERS: MembershipTier[] = ["SILVER", "GOLD", "PLATINUM", "CUSTOM"];

// OWNER: Shalmon | MODULE: Membership Plans
// GET /api/v1/admin/memberships/plans — List plans with benefits
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { page, limit, skip } = parsePagination(new URL(req.url));
    const [items, total] = await Promise.all([
      prisma.membershipPlan.findMany({
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
        include: { benefits: true, _count: { select: { customers: true } } },
      }),
      prisma.membershipPlan.count(),
    ]);
    return paginated(items, total, page, limit);
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
