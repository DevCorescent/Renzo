// ============================================================================
// MODULE : Workers — booking readiness
// ROUTE  : /api/v1/admin/workers/readiness
//
// METHOD
//   GET — Every worker in scope with what stops them being booked.
//
// WHY THIS EXISTS
// ---------------
// A stylist is only bookable when four separate things line up: an active
// profile, a branch posting, at least one qualified service, and a roster. Miss
// one and the booking engine refuses — correctly, but at the counter, with a
// customer waiting. This endpoint lets the problem be found and fixed BEFORE
// reception meets it.
//
// It ASSIGNS nothing. Fixing a worker goes through the existing
// PUT /admin/workers/:id/services and the existing shift assignment, because a
// second write path for the same data is how the two eventually disagree.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN (own branch via requireBranchScope).
// ============================================================================

import { NextRequest } from "next/server";
import { err, ok } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { loadWorkerReadiness } from "@/lib/health-service";
import { summariseReadiness } from "@/lib/worker-readiness";

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const url = new URL(req.url);
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  try {
    const all = await loadWorkerReadiness(scope);

    // ?blockedOnly=true is what the "fix these first" view asks for.
    const blockedOnly = url.searchParams.get("blockedOnly") === "true";
    const items = blockedOnly ? all.filter((r) => !r.bookable) : all;

    return ok({ items, summary: summariseReadiness(all) });
  } catch {
    return err("Internal server error", 500);
  }
}
