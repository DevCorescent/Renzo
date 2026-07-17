import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { adjustLeaveBalance, leaveDays } from "@/lib/leave-balance";
import type { AuthUser } from "@/types/api";

async function resolveWorkerId(user: AuthUser): Promise<string | null> {
  if (user.workerId) return user.workerId;
  const wp = await prisma.workerProfile.findUnique({
    where: { userId: user.userId },
    select: { id: true },
  });
  return wp?.id ?? null;
}

// OWNER: Aman | MODULE: Worker Leaves
// GET /api/v1/worker/leaves — Get own leave history
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url);
    const status = url.searchParams.get("status") ?? undefined;

    const where = { workerId, ...(status ? { status: status as never } : {}) };

    const [items, total] = await Promise.all([
      prisma.leave.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { leaveType: true },
      }),
      prisma.leave.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/worker/leaves — Apply for leave
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const body = await req.json();
    const required = ["leaveTypeId", "startDate", "endDate", "reason"];
    const missing = required.filter((f) => !body[f]);
    if (missing.length) {
      return err(
        "Validation failed",
        422,
        Object.fromEntries(missing.map((f) => [f, ["This field is required"]]))
      );
    }

    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return err("startDate and endDate must be valid dates", 422);
    }
    if (end < start) return err("endDate cannot be before startDate", 422);

    const days = leaveDays(start, end);
    const leaveType = await prisma.leaveType.findUnique({
      where: { id: body.leaveTypeId },
      select: { id: true, maxPerYear: true, isActive: true },
    });
    if (!leaveType || !leaveType.isActive) {
      return err("Invalid leaveTypeId", 422, { leaveTypeId: ["Leave type not found"] });
    }

    const year = start.getUTCFullYear();

    const leave = await prisma.$transaction(async (tx) => {
      const createdLeave = await tx.leave.create({
        data: {
          workerId,
          leaveTypeId: body.leaveTypeId,
          startDate: start,
          endDate: end,
          days,
          reason: body.reason,
          status: "PENDING",
        },
        include: { leaveType: true },
      });
      await adjustLeaveBalance(tx, {
        workerId,
        leaveTypeId: body.leaveTypeId,
        days,
        year,
        from: null,
        to: "PENDING",
        maxPerYear: leaveType.maxPerYear,
      });
      return createdLeave;
    });

    return created(leave);
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2003") {
      return err("Invalid leaveTypeId", 422);
    }
    return err("Internal server error", 500);
  }
}
