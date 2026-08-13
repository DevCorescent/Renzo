import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import prisma from "@/lib/db";
import { salonTodayAsUtcDate } from "@/lib/branch-hours";

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
          // Feeds the "Open now / Closed" badge on the booking flow. Seven small
          // rows per branch; the caller resolves the state with
          // lib/branch-hours so the badge and the slot engine agree.
          timings: {
            orderBy: { dayOfWeek: "asc" },
            select: { dayOfWeek: true, isOpen: true, openTime: true, closeTime: true },
          },
          // Only TODAY's holiday — a holiday shuts the branch regardless of the
          // weekly schedule, and the full list would be dead weight here.
          holidays: {
            where: { date: salonTodayAsUtcDate() },
            select: { date: true },
            take: 1,
          },
        },
      }),
      prisma.branch.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
