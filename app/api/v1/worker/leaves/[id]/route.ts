import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { adjustLeaveBalance } from "@/lib/leave-balance";
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
// GET /api/v1/worker/leaves/[id] — View own leave request by ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const { id } = await params;
    const leave = await prisma.leave.findFirst({
      where: { id, workerId },
      include: { leaveType: true },
    });
    if (!leave) return err("Leave not found", 404);

    return ok(leave);
  } catch {
    return err("Internal server error", 500);
  }
}

// DELETE /api/v1/worker/leaves/[id] — Soft-cancel own leave (PENDING or APPROVED)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const { id } = await params;
    const leave = await prisma.leave.findFirst({
      where: { id, workerId },
      select: {
        id: true,
        status: true,
        days: true,
        leaveTypeId: true,
        workerId: true,
        startDate: true,
      },
    });
    if (!leave) return err("Leave not found", 404);
    if (leave.status !== "PENDING" && leave.status !== "APPROVED") {
      return err("Only pending or approved leave can be cancelled", 409);
    }

    const year = leave.startDate.getUTCFullYear();

    await prisma.$transaction(async (tx) => {
      await tx.leave.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      await adjustLeaveBalance(tx, {
        workerId: leave.workerId,
        leaveTypeId: leave.leaveTypeId,
        days: leave.days,
        year,
        from: leave.status,
        to: "CANCELLED",
      });
    });

    const updated = await prisma.leave.findUnique({
      where: { id },
      include: { leaveType: true },
    });

    return ok(updated, "Leave request cancelled");
  } catch {
    return err("Internal server error", 500);
  }
}
