// ============================================================================
// OWNER  : Gauransh
// MODULE : Leave Management (admin)
// ROUTE  : /api/v1/admin/leaves
//
// METHODS
//   GET  — List leave requests (branch-scoped).
//   POST — Direct-grant leave to a worker (creates as APPROVED).
// ============================================================================

import { NextRequest } from "next/server";
import type { Prisma, LeaveStatus } from "@prisma/client";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, workerBranchWhere, denyIfWorkerOutOfScope } from "@/lib/branch-scope";
import prisma from "@/lib/db";
import { adjustLeaveBalance, leaveDays } from "@/lib/leave-balance";

const LEAVE_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;

const SORTABLE = new Set(["createdAt", "startDate"]);

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

    const statusParam = url.searchParams.get("status");
    const status =
      statusParam && LEAVE_STATUSES.includes(statusParam as LeaveStatus)
        ? (statusParam as LeaveStatus)
        : undefined;

    const leaveTypeId = url.searchParams.get("leaveTypeId")?.trim() || undefined;
    const workerId = url.searchParams.get("workerId")?.trim() || undefined;

    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"));

    const sortByRaw = url.searchParams.get("sortBy") ?? "createdAt";
    const sortBy = SORTABLE.has(sortByRaw) ? sortByRaw : "createdAt";
    const sortOrder: Prisma.SortOrder =
      url.searchParams.get("sortOrder")?.toLowerCase() === "asc" ? "asc" : "desc";

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
      ...(workerId ? { workerId } : {}),
      ...(status ? { status } : {}),
      ...(leaveTypeId ? { leaveTypeId } : {}),
      ...(to ? { startDate: { lte: to } } : {}),
      ...(from ? { endDate: { gte: from } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.leave.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ [sortBy]: sortOrder }, { id: "asc" }],
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          days: true,
          reason: true,
          approvedBy: true,
          approvedAt: true,
          rejectionReason: true,
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

/** POST — Admin direct-grant leave (creates as APPROVED). */
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const required = ["workerId", "leaveTypeId", "startDate", "endDate", "reason"] as const;
    const missing = required.filter((f) => !body[f]);
    if (missing.length) {
      return err(
        "Validation failed",
        422,
        Object.fromEntries(missing.map((f) => [f, ["This field is required"]]))
      );
    }

    const workerId = String(body.workerId);
    const denied = await denyIfWorkerOutOfScope(prisma, workerId, scope);
    if (denied) return denied;

    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return err("startDate and endDate must be valid dates", 422);
    }
    if (end < start) return err("endDate cannot be before startDate", 422);

    const leaveType = await prisma.leaveType.findUnique({
      where: { id: String(body.leaveTypeId) },
      select: { id: true, maxPerYear: true, isActive: true },
    });
    if (!leaveType || !leaveType.isActive) {
      return err("Invalid leaveTypeId", 422, { leaveTypeId: ["Leave type not found"] });
    }

    const days = leaveDays(start, end);
    const year = start.getUTCFullYear();
    const now = new Date();

    const leave = await prisma.$transaction(async (tx) => {
      const createdLeave = await tx.leave.create({
        data: {
          workerId,
          leaveTypeId: leaveType.id,
          startDate: start,
          endDate: end,
          days,
          reason: String(body.reason),
          status: "APPROVED",
          approvedBy: user.userId,
          approvedAt: now,
        },
        include: {
          leaveType: true,
          worker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              employeeCode: true,
            },
          },
        },
      });

      await adjustLeaveBalance(tx, {
        workerId,
        leaveTypeId: leaveType.id,
        days,
        year,
        from: null,
        to: "APPROVED",
        maxPerYear: leaveType.maxPerYear,
      });

      return createdLeave;
    });

    return created(leave, "Leave granted");
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2003") {
      return err("Invalid workerId or leaveTypeId", 422);
    }
    return err("Internal server error", 500);
  }
}
