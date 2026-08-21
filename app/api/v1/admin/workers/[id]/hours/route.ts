// ============================================================================
// OWNER  : Aman
// MODULE : Worker working hours
// ROUTE  : /api/v1/admin/workers/[id]/hours
//
// METHODS
// GET  - Read the worker's rostered working window (Shift + WorkerShift)
// PUT  - Create/update a personal Shift and assign it at the caller's branch
//
// ACCESS
// GET/PUT - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// BRANCH_ADMIN may only touch workers assigned to their own branch.
// ============================================================================

import { NextRequest } from "next/server";
import { err, ok } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { validate, readJson } from "@/lib/validate";
import {
  WorkerHoursSchema,
  authorizeHoursAccess,
  getWorkerHours,
  upsertWorkerHours,
} from "@/lib/worker-hours";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const { error: accessError } = await authorizeHoursAccess(user, id);
    if (accessError) return accessError;

    const hours = await getWorkerHours(
      id,
      user.userType === "BRANCH_ADMIN" ? user.branchId : undefined
    );
    return ok(hours, "Worker hours fetched successfully");
  } catch {
    return err("Internal server error", 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const parsed = validate(WorkerHoursSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  try {
    const { id } = await params;
    const result = await upsertWorkerHours(user, id, parsed.data);
    if (result.error) return result.error;
    return ok(result.hours, "Worker hours updated successfully");
  } catch {
    return err("Internal server error", 500);
  }
}
