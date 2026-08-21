// ============================================================================
// OWNER  : Aman
// MODULE : Worker — own working hours
// ROUTE  : /api/v1/worker/hours
//
// METHODS
// GET  - Read own rostered working window
// PUT  - Update own working window (personal Shift + WorkerShift)
//
// ACCESS
// WORKER only. Cannot read or write another worker's hours.
// ============================================================================

import { NextRequest } from "next/server";
import { err, ok } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { validate, readJson } from "@/lib/validate";
import {
  WorkerHoursSchema,
  getWorkerHours,
  upsertWorkerHours,
} from "@/lib/worker-hours";
import type { AuthUser } from "@/types/api";

async function resolveWorkerId(user: AuthUser): Promise<string | null> {
  if (user.workerId) return user.workerId;
  const wp = await prisma.workerProfile.findUnique({
    where: { userId: user.userId },
    select: { id: true },
  });
  return wp?.id ?? null;
}

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);
    const hours = await getWorkerHours(workerId);
    return ok(hours, "Worker hours fetched successfully");
  } catch {
    return err("Internal server error", 500);
  }
}

export async function PUT(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  const parsed = validate(WorkerHoursSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);
    const result = await upsertWorkerHours({ ...user, workerId }, workerId, parsed.data);
    if (result.error) return result.error;
    return ok(result.hours, "Worker hours updated successfully");
  } catch {
    return err("Internal server error", 500);
  }
}
