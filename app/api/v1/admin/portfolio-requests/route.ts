import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, workerBranchWhere } from "@/lib/branch-scope";
import { isChangeType } from "@/lib/portfolio-requests";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Admin — Portfolio Change Requests
// ROUTE : /api/v1/admin/portfolio-requests
//
// METHOD: GET — The Branch Admin review queue: worker portfolio change requests
//         scoped to the caller's branch, with status / type filters and search.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN.
//
// BRANCH ISOLATION: a request has no branchId; it belongs to a worker, whose branch
// lives in WorkerBranch. So the scope is applied THROUGH the worker relation via
// workerBranchWhere() — the same primitive Workers and Leaves use.

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "NEEDS_CHANGES"];

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const url = new URL(req.url);
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  try {
    const { page, limit, skip, search } = parsePagination(url);

    const statusParam = url.searchParams.get("status");
    const validStatus = statusParam && STATUSES.includes(statusParam) ? statusParam : undefined;

    const typeParam = url.searchParams.get("type");
    // isChangeType narrows to the PortfolioChangeType enum, so `type` needs no cast.
    const type = isChangeType(typeParam) ? typeParam : undefined;

    // Branch scope AND search both live under the worker relation, so search can
    // never widen past the caller's branch.
    const workerFilter: Prisma.WorkerProfileWhereInput = {
      ...workerBranchWhere(scope),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { displayName: { contains: search, mode: "insensitive" as const } },
              { employeeCode: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const where: Prisma.PortfolioChangeRequestWhereInput = {
      worker: workerFilter,
      // Cast via the WhereInput's own field type — keeps this robust with only the
      // `Prisma` import (no separate enum import for a formatter to churn on).
      ...(validStatus ? { status: validStatus as Prisma.PortfolioChangeRequestWhereInput["status"] } : {}),
      ...(type ? { type } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.portfolioChangeRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: {
          worker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              employeeCode: true,
              profilePhoto: true,
              designation: { select: { name: true } },
              branches: {
                where: { isActive: true },
                select: { isPrimary: true, branch: { select: { id: true, name: true } } },
              },
            },
          },
        },
      }),
      prisma.portfolioChangeRequest.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
