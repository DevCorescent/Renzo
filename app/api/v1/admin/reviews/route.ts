import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, branchWhere } from "@/lib/branch-scope";
import prisma from "@/lib/db";
import type { ReviewStatus, Prisma } from "@prisma/client";

// OWNER: Shalmon | MODULE: Reviews — Admin Moderation
// GET /api/v1/admin/reviews — List reviews (filter status, branchId, workerId)
//
// BRANCH SCOPE: moderation is a branch's own business. Reading the branch from
// the query param let a branch admin moderate — and read the customer names in —
// another branch's reviews.
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const url = new URL(req.url);
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  try {
    const { page, limit, skip } = parsePagination(url);
    const status = url.searchParams.get("status");
    const workerId = url.searchParams.get("workerId");

    const where: Prisma.ReviewWhereInput = {
      ...branchWhere(scope),
      ...(status ? { status: status as ReviewStatus } : {}),
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
