import { NextRequest } from "next/server";
import { Prisma, Gender } from "@prisma/client";
import { err, paginated } from "@/lib/response";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Public Services
// ROUTE  : /api/v1/public/services
//
// METHOD
// GET - List Active Services (Public)
//
// ACCESS
// Public (No Authentication)
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);

    const page = Math.max(Number(url.searchParams.get("page") ?? "1"), 1);
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? "10"), 1),
      100
    );
    const skip = (page - 1) * limit;

    const search = url.searchParams.get("search")?.trim();
    const categoryId = url.searchParams.get("categoryId");
    const gender = url.searchParams.get("gender");
    const isPopular = url.searchParams.get("isPopular");

    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      // Don't surface services whose category has been soft-deleted/deactivated,
      // even if the service row itself is still marked active.
      category: { isActive: true },
    };

    // ------------------------------------------------------------------------
    // Search
    // ------------------------------------------------------------------------

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // ------------------------------------------------------------------------
    // Filters
    // ------------------------------------------------------------------------

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (gender && Object.values(Gender).includes(gender as Gender)) {
      where.gender = gender as Gender;
    }

    if (isPopular === "true") {
      where.isPopular = true;
    }

    const [services, total] = await Promise.all([
      prisma.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        // Explicit whitelist — this is a PUBLIC, unauthenticated endpoint.
        // Only fields a customer should ever see go here. Add to this list
        // deliberately; never switch back to a bare `include` on this route.
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          image: true,
          basePrice: true,
          duration: true,
          gender: true,
          isPopular: true,
          sortOrder: true,
          category: {
            select: { id: true, name: true },
          },
          variants: {
            where: { isActive: true },
            orderBy: { price: "asc" },
            select: {
              id: true,
              name: true,
              price: true,
              duration: true,
            },
          },
          _count: {
            select: { variants: true },
          },
        },
      }),
      prisma.service.count({ where }),
    ]);

    return paginated(services, total, page, limit, "Services fetched successfully");
  } catch (error) {
    console.error("GET Public Services Error:", error);
    return err("Internal server error", 500);
  }
}