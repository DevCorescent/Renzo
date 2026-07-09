import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { CouponType, CouponApplicableTo, Prisma } from "@prisma/client";

const TYPES: CouponType[] = ["FLAT", "PERCENTAGE"];
const APPLICABLE: CouponApplicableTo[] = [
  "ALL", "SPECIFIC_SERVICE", "SPECIFIC_CATEGORY", "SPECIFIC_BRANCH", "FIRST_BOOKING",
];

// OWNER: Shalmon | MODULE: Coupons
// GET /api/v1/admin/coupons — List coupons (paginated, search by code)
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const { page, limit, skip, search } = parsePagination(new URL(req.url));
    const where: Prisma.CouponWhereInput = search
      ? { code: { contains: search, mode: "insensitive" } }
      : {};

    const [items, total] = await Promise.all([
      prisma.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { usages: true } } },
      }),
      prisma.coupon.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/coupons — Create a coupon
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const code: string = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    const value = Number(body.value);
    const errors: Record<string, string[]> = {};
    if (!code) errors.code = ["Code is required"];
    if (!TYPES.includes(body.type)) errors.type = ["type must be FLAT or PERCENTAGE"];
    if (!Number.isFinite(value) || value <= 0) errors.value = ["value must be a positive number"];
    if (!body.validFrom || isNaN(Date.parse(body.validFrom))) errors.validFrom = ["validFrom must be a valid date"];
    if (Object.keys(errors).length) return err("Validation failed", 422, errors);

    const exists = await prisma.coupon.findUnique({ where: { code } });
    if (exists) return err("Coupon code already exists", 409);

    const coupon = await prisma.coupon.create({
      data: {
        code,
        description: typeof body.description === "string" ? body.description : null,
        type: body.type,
        value,
        minOrderAmount: Number(body.minOrderAmount) || 0,
        maxDiscount: body.maxDiscount != null ? Number(body.maxDiscount) : null,
        applicableTo: APPLICABLE.includes(body.applicableTo) ? body.applicableTo : "ALL",
        refId: typeof body.refId === "string" ? body.refId : null,
        usageLimit: body.usageLimit != null ? Number(body.usageLimit) : null,
        usageLimitPerCustomer: Number(body.usageLimitPerCustomer) || 1,
        validFrom: new Date(body.validFrom),
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        isActive: body.isActive !== false,
        createdBy: user.userId,
      },
    });
    return created(coupon, "Coupon created");
  } catch {
    return err("Internal server error", 500);
  }
}
