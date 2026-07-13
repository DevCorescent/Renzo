import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import prisma from "@/lib/db";
import type { OfferType, Prisma } from "@prisma/client";

// OWNER: Shalmon | MODULE: Public Offers
// GET /api/v1/public/offers?branchId&type — Currently-valid public offers
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const branchId = url.searchParams.get("branchId");
    const type = url.searchParams.get("type");
    const now = new Date();

    const where: Prisma.OfferWhereInput = {
      isActive: true,
      validFrom: { lte: now },
      // Either open-ended, or not yet expired.
      OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      // A branch page shows that branch's offers plus the all-branch ones.
      ...(branchId ? { AND: [{ OR: [{ branchId }, { branchId: null }] }] } : {}),
      ...(type ? { type: type as OfferType } : {}),
    };

    const offers = await prisma.offer.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { validFrom: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        image: true,
        type: true,
        discountPercent: true,
        discountAmount: true,
        validFrom: true,
        validUntil: true,
        branchId: true,
      },
    });

    return ok(offers);
  } catch {
    return err("Internal server error", 500);
  }
}
