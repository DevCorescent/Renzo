import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Public Branches
// GET /api/v1/public/branches — List active public branches (no auth)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);
    const city = url.searchParams.get("city") ?? undefined;

    const where = {
      isActive: true,
      isPublic: true,
      ...(city ? { city: { equals: city, mode: "insensitive" as const } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { city: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.branch.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          state: true,
          address: true,
          phone: true,
          coverImage: true,
          lat: true,
          lng: true,
        },
      }),
      prisma.branch.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
