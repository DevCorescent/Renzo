// ============================================================================
// OWNER  : Gauransh
// MODULE : Leave Management (admin)
// ROUTE  : /api/v1/admin/leaves
//
// METHOD
//   GET — List worker leave requests for the caller's branch, with search,
//         status / leave-type / date filters, sorting and pagination.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN.
//
// WHY THIS ROUTE EXISTS
//   The Leave model had only worker-facing endpoints (a worker sees their OWN
//   leaves). A branch admin had no way to see their staff's requests, so this is
//   the missing admin read side. It changes no existing contract.
//
// BRANCH ISOLATION
//   Leave has NO branchId column — a leave belongs to a worker, and a worker's
//   branch lives in the WorkerBranch join table. So the scope is applied THROUGH
//   the worker relation via workerBranchWhere(). A BRANCH_ADMIN is pinned to their
//   own branch (a ?branchId in the query is ignored); SUPER_ADMIN / OWNER are
//   global and may narrow with ?branchId. This is the same primitive the Workers
//   module uses — not a new isolation scheme.
// ============================================================================

import { NextRequest } from "next/server";
import type { Prisma, LeaveStatus } from "@prisma/client";
import { err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, workerBranchWhere } from "@/lib/branch-scope";
import prisma from "@/lib/db";

const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

// Only these columns are sortable — an arbitrary ?sortBy can't reach Prisma and
// turn the listing into an unindexed scan. "createdAt" is the applied date.
const SORTABLE = new Set(["createdAt", "startDate"]);

/** A parseable date param, or undefined. */
function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const url = new URL(req.url);
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  try {
    const { page, limit, skip, search } = parsePagination(url);

    // ── Filters ────────────────────────────────────────────────────────────
    const statusParam = url.searchParams.get("status");
    const status =
      statusParam && LEAVE_STATUSES.includes(statusParam as LeaveStatus)
        ? (statusParam as LeaveStatus)
        : undefined;

    const leaveTypeId = url.searchParams.get("leaveTypeId")?.trim() || undefined;

    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"));

    // ── Sorting ────────────────────────────────────────────────────────────
    const sortByRaw = url.searchParams.get("sortBy") ?? "createdAt";
    const sortBy = SORTABLE.has(sortByRaw) ? sortByRaw : "createdAt";
    const sortOrder: Prisma.SortOrder =
      url.searchParams.get("sortOrder")?.toLowerCase() === "asc" ? "asc" : "desc";

    // The worker filter carries BOTH the branch scope and the free-text search,
    // so search can never widen past the caller's branch — both live under the
    // same related-worker match.
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

    const where: Prisma.LeaveWhereInput = {
      worker: workerFilter,
      ...(status ? { status } : {}),
      ...(leaveTypeId ? { leaveTypeId } : {}),
      // Date-range = leaves whose period OVERLAPS [from, to]: start ≤ to AND
      // end ≥ from. Each bound is optional and applied independently.
      ...(to ? { startDate: { lte: to } } : {}),
      ...(from ? { endDate: { gte: from } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.leave.findMany({
        where,
        skip,
        take: limit,
        // id tiebreaker keeps pagination stable when two rows share a sort value.
        orderBy: [{ [sortBy]: sortOrder }, { id: "asc" }],
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          days: true,
          reason: true,
          createdAt: true,
          leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
          worker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              employeeCode: true,
              profilePhoto: true,
              designation: { select: { name: true } },
              // The worker's active branch — one nested read, no N+1. Redundant for
              // a branch admin (single branch) but meaningful for a global admin.
              branches: {
                where: { isActive: true },
                select: { isPrimary: true, branch: { select: { id: true, name: true, code: true } } },
              },
            },
          },
        },
      }),
      prisma.leave.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
