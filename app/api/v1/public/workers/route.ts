import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

// OWNER: Aman | MODULE: Public Workers
// GET /api/v1/public/workers — List public worker profiles (no auth)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);
    const branchId = url.searchParams.get("branchId") ?? undefined;

    const where: Prisma.WorkerProfileWhereInput = {
      isPublic: true,
      isActive: true,
      ...(branchId
        ? { branches: { some: { branchId, isActive: true } } }
        : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { displayName: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.workerProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          bio: true,
          profilePhoto: true,
          experience: true,
          languages: true,
          designation: { select: { name: true, level: true } },
          skills: { select: { skill: { select: { name: true } }, proficiency: true } },
        },
      }),
      prisma.workerProfile.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
