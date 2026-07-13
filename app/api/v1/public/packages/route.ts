import { NextRequest } from "next/server";
import { Prisma, Gender } from "@prisma/client";
import { err, paginated } from "@/lib/response";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Public Packages
// ROUTE  : /api/v1/public/packages
//
// METHOD
// GET - List Active Packages (Public)
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
    const gender = url.searchParams.get("gender");
    const isPopular = url.searchParams.get("isPopular");

    const where: Prisma.PackageWhereInput = {
      isActive: true,
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

    if (gender && Object.values(Gender).includes(gender as Gender)) {
      where.gender = gender as Gender;
    }

    if (isPopular === "true") {
      where.isPopular = true;
    }

    const [packages, total] = await Promise.all([
      prisma.package.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          image: true,
          price: true,
          originalPrice: true,
          validityDays: true,
          gender: true,
          isPopular: true,
          sortOrder: true,
          services: {
            // Don't surface package-service line items whose underlying
            // service has been deactivated — otherwise a customer sees a
            // package advertising a service they can no longer book.
            where: {
              service: { isActive: true },
            },
            select: {
              quantity: true,
              service: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  image: true,
                  basePrice: true,
                  duration: true,
                },
              },
            },
          },
          // Reflects the count of ALL linked services regardless of active
          // status. If you want this number to match what's actually shown
          // above, this needs to become a manual count (e.g. services.length
          // after the query) rather than Prisma's relation _count, since
          // _count doesn't support a `where` filter tied to the select above
          // in this Prisma version — flagging so the two don't silently
          // drift apart.
          _count: {
            select: { services: true },
          },
        },
      }),
      prisma.package.count({ where }),
    ]);

    return paginated(packages, total, page, limit, "Packages fetched successfully");
  } catch (error) {
    console.error("GET Public Packages Error:", error);
    return err("Internal server error", 500);
  }
}