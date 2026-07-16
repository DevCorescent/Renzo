import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { CouponType, CouponApplicableTo, Prisma } from "@prisma/client";

const TYPES: CouponType[] = ["FLAT", "PERCENTAGE"];
const APPLICABLE: CouponApplicableTo[] = [
  "ALL", "SPECIFIC_SERVICE", "SPECIFIC_CATEGORY", "SPECIFIC_BRANCH", "FIRST_BOOKING",
];

// A parseable date param, or undefined.
function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// OWNER: Shalmon | MODULE: Coupons
// GET /api/v1/admin/coupons — List coupons (paginated).
//
// Backend-driven search + filters (all optional, additive — no param = original
// behaviour): search (code OR description), status (active / upcoming / expired /
// disabled — derived live from isActive + validFrom + validUntil, no stored column),
// type, applicableTo, and a validity date-range overlap (from / to).
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);
    const now = new Date();

    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");
    const applicableTo = url.searchParams.get("applicableTo");
    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"));

    // Each filter is a separate AND clause so they compose without clobbering each
    // other's OR groups (search / active-window both use OR internally).
    const and: Prisma.CouponWhereInput[] = [];
    if (search) {
      and.push({
        OR: [
          { code: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (type && TYPES.includes(type as CouponType)) and.push({ type: type as CouponType });
    if (applicableTo && APPLICABLE.includes(applicableTo as CouponApplicableTo)) {
      and.push({ applicableTo: applicableTo as CouponApplicableTo });
    }
    // Status derived from the three real fields (no new column):
    if (status === "disabled") and.push({ isActive: false });
    else if (status === "active") and.push({ isActive: true, validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gte: now } }] });
    else if (status === "upcoming") and.push({ isActive: true, validFrom: { gt: now } });
    else if (status === "expired") and.push({ isActive: true, validUntil: { lt: now } });
    // Date-range = coupons whose validity window overlaps [from, to].
    if (from) and.push({ OR: [{ validUntil: null }, { validUntil: { gte: from } }] });
    if (to) and.push({ validFrom: { lte: to } });

    const where: Prisma.CouponWhereInput = and.length ? { AND: and } : {};

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
