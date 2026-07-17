// ============================================================================
// OWNER  : Gauransh
// MODULE : Super Admin Leave Management
// ROUTE  : /api/v1/admin/leaves/balance
//
// METHOD
//   GET — Read-only leave balance for ONE worker in a year, for the approval
//         modal. Straight off the existing LeaveBalance table; nothing is written
//         and no balance is recomputed here.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN — the same set as the rest of the admin
//   leave surface.
//
// BRANCH ISOLATION
//   LeaveBalance is worker-owned and has no branchId, so access is guarded THROUGH
//   the worker with denyIfWorkerOutOfScope() (404 for an out-of-scope worker) —
//   the same primitive the leave list/detail routes use. A BRANCH_ADMIN can only
//   read balances for a worker in their own branch.
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, denyIfWorkerOutOfScope } from "@/lib/branch-scope";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  // PERMISSION — identical role set to the leave list/detail/stats routes.
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const url = new URL(req.url);
    const workerId = url.searchParams.get("workerId")?.trim();
    if (!workerId) return err("Validation failed", 422, { workerId: ["workerId is required"] });

    // Default to the current year; a caller may request a specific one.
    const yearParam = Number(url.searchParams.get("year"));
    const year = Number.isInteger(yearParam) && yearParam > 2000 ? yearParam : new Date().getUTCFullYear();

    // BRANCH GUARD — refuse (as 404) a worker outside the caller's branch before any
    // balance is revealed.
    const denied = await denyIfWorkerOutOfScope(prisma, workerId, scope);
    if (denied) return denied;

    const balances = await prisma.leaveBalance.findMany({
      where: { workerId, year },
      orderBy: { leaveType: { name: "asc" } },
      select: {
        id: true,
        year: true,
        allocated: true,
        used: true,
        pending: true,
        remaining: true,
        leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
      },
    });

    return ok({ workerId, year, balances });
  } catch {
    return err("Internal server error", 500);
  }
}
