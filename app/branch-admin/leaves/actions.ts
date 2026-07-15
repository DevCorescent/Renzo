"use server";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Branch Admin — Leave approvals (Server Action)
//
// The status transition goes through the HTTP API — never Prisma — so
// requireAuth(), the branch-isolation guard (denyIfWorkerOutOfScope), the
// PENDING-only rule and the atomic race guard stay the single source of truth.
// This file re-implements none of it.
//
// PATCH /api/v1/admin/leaves/[id] { status } is the ONE mutation: approve and
// reject are the same call with a different status. Branch isolation is NOT
// re-checked here — the route refuses a leave outside the caller's branch.
// ============================================================================

import { revalidatePath } from "next/cache";
import { apiPatch } from "@/lib/api-server";
import { API } from "@/lib/endpoints";
import type { FormState } from "@/lib/form-state";

const LEAVES_PATH = "/branch-admin/leaves";

/** Approve or reject a pending leave. status is "APPROVED" | "REJECTED". */
export async function setLeaveStatusAction(
  id: string,
  status: "APPROVED" | "REJECTED"
): Promise<FormState> {
  if (!id) return { status: "error", message: "Leave id is required", errors: {} };

  const result = await apiPatch(API.admin.leave(id), { status });
  if (!result.ok) {
    return { status: "error", message: result.message, errors: result.errors ?? {} };
  }

  // Refresh the list and the stat cards so the row's new status and the counts are
  // correct the instant the drawer closes — no client refetch.
  revalidatePath(LEAVES_PATH);
  return {
    status: "success",
    message: status === "APPROVED" ? "Leave approved" : "Leave rejected",
    errors: {},
  };
}
