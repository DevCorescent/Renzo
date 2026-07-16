"use server";

// OWNER: Gauransh
// MODULE: Super Admin Leave Management

// ============================================================================
// The status transition goes through the HTTP API — never Prisma — so requireAuth(),
// the branch-isolation guard, the PENDING-only rule and the atomic race guard remain
// the single source of truth. This re-implements none of it: approve and reject are
// the same PATCH /api/v1/admin/leaves/[id] { status } with a different status.
// ============================================================================

import { revalidatePath } from "next/cache";
import { apiPatch } from "@/lib/api-server";
import { API } from "@/lib/endpoints";
import type { FormState } from "@/lib/form-state";

const LEAVES_PATH = "/super-admin/leaves";

/** Approve or reject a pending leave. status is "APPROVED" | "REJECTED". */
export async function setSuperLeaveStatusAction(
  id: string,
  status: "APPROVED" | "REJECTED"
): Promise<FormState> {
  if (!id) return { status: "error", message: "Leave id is required", errors: {} };

  const result = await apiPatch(API.admin.leave(id), { status });
  if (!result.ok) {
    return { status: "error", message: result.message, errors: result.errors ?? {} };
  }

  // Refresh the list + stat cards so counts and statuses are correct the instant the
  // modal closes — no client refetch, filters and pagination preserved in the URL.
  revalidatePath(LEAVES_PATH);
  return {
    status: "success",
    message: status === "APPROVED" ? "Leave approved" : "Leave rejected",
    errors: {},
  };
}
