import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { OfferType, Prisma } from "@prisma/client";

const TYPES: OfferType[] = ["SEASONAL", "FIRST_BOOKING", "MEMBERSHIP", "FLASH", "REFERRAL"];

// OWNER: Shalmon | MODULE: Offers
// GET /api/v1/admin/offers — List offers (filter branchId, type, isActive)
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url);
    const branchId = url.searchParams.get("branchId");
    const type = url.searchParams.get("type");
    const isActive = url.searchParams.get("isActive");

    const where: Prisma.OfferWhereInput = {
      ...(branchId ? { branchId } : {}),
      ...(type ? { type: type as OfferType } : {}),
      ...(isActive != null ? { isActive: isActive === "true" } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.offer.findMany({ where, skip, take: limit, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] }),
      prisma.offer.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/offers — Create an offer
export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const title: string = typeof body.title === "string" ? body.title.trim() : "";
    const errors: Record<string, string[]> = {};
    if (!title) errors.title = ["Title is required"];
    if (!TYPES.includes(body.type)) errors.type = ["Invalid offer type"];
    if (!body.validFrom || isNaN(Date.parse(body.validFrom))) errors.validFrom = ["validFrom must be a valid date"];
    if (Object.keys(errors).length) return err("Validation failed", 422, errors);

    const offer = await prisma.offer.create({
      data: {
        title,
        description: typeof body.description === "string" ? body.description : null,
        image: typeof body.image === "string" ? body.image : null,
        type: body.type,
        branchId: typeof body.branchId === "string" ? body.branchId : null,
        discountPercent: body.discountPercent != null ? Number(body.discountPercent) : null,
        discountAmount: body.discountAmount != null ? Number(body.discountAmount) : null,
        validFrom: new Date(body.validFrom),
        validUntil: body.validUntil ? new Date(body.validUntil) : null,
        isActive: body.isActive !== false,
        sortOrder: Number(body.sortOrder) || 0,
      },
    });
    return created(offer, "Offer created");
  } catch {
    return err("Internal server error", 500);
  }
}
