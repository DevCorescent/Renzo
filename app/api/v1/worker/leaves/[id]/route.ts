import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
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
    // Scope by workerId so a worker can only read their own leave.
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

// DELETE /api/v1/worker/leaves/[id] — Cancel own leave request (only if pending)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const { id } = await params;
    const leave = await prisma.leave.findFirst({
      where: { id, workerId },
      select: { id: true, status: true },
    });
    if (!leave) return err("Leave not found", 404);
    if (leave.status !== "PENDING") {
      return err("Only pending leave requests can be cancelled", 409);
    }

    await prisma.leave.delete({ where: { id } });
    return ok(null, "Leave request cancelled");
  } catch {
    return err("Internal server error", 500);
  }
}
