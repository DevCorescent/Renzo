"use server";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Branch Admin — Portfolio request review (Server Action)
//
// The review goes through the HTTP API — never Prisma — so requireAuth(), the
// branch-isolation guard (denyIfWorkerOutOfScope), the PENDING-only rule, the
// atomic compare-and-swap and the apply-on-approve all stay the single source of
// truth in the route. This file re-implements none of it.
//
// One mutation covers all three decisions: PATCH /api/v1/admin/portfolio-requests/[id]
// { action, reviewNote }. A note is required to reject or request changes — the
// route enforces that; the client mirrors it so the admin is told before the call.
// ============================================================================

import { revalidatePath } from "next/cache";
import { apiPatch } from "@/lib/api-server";
import { API } from "@/lib/endpoints";
import type { FormState } from "@/lib/form-state";
import type { ReviewAction } from "@/components/portfolio-requests-admin/types";

const REQUESTS_PATH = "/branch-admin/portfolio-requests";

/** Approve, reject or return a pending portfolio request for changes. */
export async function reviewPortfolioRequestAction(
  id: string,
  action: ReviewAction,
  reviewNote: string
): Promise<FormState> {
  if (!id) return { status: "error", message: "Request id is required", errors: {} };

  const result = await apiPatch(API.admin.portfolioRequest(id), {
    action,
    reviewNote: reviewNote.trim(),
  });
  if (!result.ok) {
    return { status: "error", message: result.message, errors: result.errors ?? {} };
  }

  // Refresh the list + counts so the actioned row updates the instant the drawer
  // closes — the approve path also applied the change to the live portfolio.
  revalidatePath(REQUESTS_PATH);

  const verb = action === "APPROVE" ? "approved" : action === "REJECT" ? "rejected" : "returned for changes";
  return { status: "success", message: `Request ${verb}`, errors: {} };
}
