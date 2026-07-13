import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { ReviewStatus, Prisma } from "@prisma/client";

// OWNER: Shalmon | MODULE: Reviews — Admin Moderation
// GET /api/v1/admin/reviews — List reviews (filter status, branchId, workerId)
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url);
    const status = url.searchParams.get("status");
    const branchId = url.searchParams.get("branchId");
    const workerId = url.searchParams.get("workerId");

    const where: Prisma.ReviewWhereInput = {
      ...(status ? { status: status as ReviewStatus } : {}),
      ...(branchId ? { branchId } : {}),
      ...(workerId ? { workerId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          customer: { select: { firstName: true, lastName: true } },
          worker: { select: { displayName: true, firstName: true, lastName: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
