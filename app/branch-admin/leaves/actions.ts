"use server";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Branch Admin — Leave approvals (Server Actions)
//
// Approve / reject go through the HTTP API — never Prisma — so requireAuth(), the
// branch-isolation guard (denyIfWorkerOutOfScope) and the PENDING-only state check
// stay the single source of truth. This file re-implements none of it.
//
// Branch isolation is NOT re-checked here: the route resolves the caller's branch
// from the session cookie and refuses a leave outside it. The UI cannot widen that.
// ============================================================================

import { revalidatePath } from "next/cache";
import { apiPost } from "@/lib/api-server";
import { API } from "@/lib/endpoints";
import type { FormState } from "@/lib/form-state";

const LEAVES_PATH = "/branch-admin/leaves";

/** POST /api/v1/admin/leaves/[id]/approve */
export async function approveLeaveAction(id: string): Promise<FormState> {
  if (!id) return { status: "error", message: "Leave id is required", errors: {} };

  const result = await apiPost(API.admin.leaveApprove(id), {});
  if (!result.ok) {
    return { status: "error", message: result.message, errors: result.errors ?? {} };
  }

  // Refresh the list and the stats cards so the row's new status and the counts
  // are correct the instant the drawer closes — no client refetch.
  revalidatePath(LEAVES_PATH);
  return { status: "success", message: "Leave approved", errors: {} };
}

/** POST /api/v1/admin/leaves/[id]/reject  { reason } */
export async function rejectLeaveAction(id: string, reason: string): Promise<FormState> {
  if (!id) return { status: "error", message: "Leave id is required", errors: {} };

  const result = await apiPost(API.admin.leaveReject(id), { reason: reason.trim() });
  if (!result.ok) {
    return { status: "error", message: result.message, errors: result.errors ?? {} };
  }

  revalidatePath(LEAVES_PATH);
  return { status: "success", message: "Leave rejected", errors: {} };
}
