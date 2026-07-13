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

// OWNER: Aman | MODULE: Worker Shifts
// GET /api/v1/worker/shifts — Get own active shift assignments
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const shifts = await prisma.workerShift.findMany({
      where: { workerId, isActive: true },
      orderBy: { startDate: "desc" },
      include: {
        shift: true,
        branch: { select: { id: true, name: true } },
      },
    });

    return ok(shifts);
  } catch {
    return err("Internal server error", 500);
  }
}
