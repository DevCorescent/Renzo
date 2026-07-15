// ============================================================================
// OWNER  : Gauransh
// MODULE : Leave Management (admin)
// ROUTE  : /api/v1/admin/leaves/stats
//
// METHOD
//   GET — Branch-wide leave counts by status, for the summary cards.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN.
//
// Deliberately branch-WIDE and independent of the table's status / date / search
// filters: the cards are a fixed overview of the branch, not a reflection of the
// current table view (filtering to "Rejected" must not zero the Pending card).
// Same branch isolation as the list route, through the worker relation.
//
// One grouped query, so the four cards cost a single round trip and can never
// disagree with each other the way four separate counts might under concurrent
// writes.
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, workerBranchWhere } from "@/lib/branch-scope";
import prisma from "@/lib/db";

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user, new URL(req.url));
  if (scopeError) return scopeError;

  try {
    const grouped = await prisma.leave.groupBy({
      by: ["status"],
      where: { worker: workerBranchWhere(scope) },
      _count: { _all: true },
    });

    const stats = { pending: 0, approved: 0, rejected: 0, cancelled: 0, total: 0 };
    for (const row of grouped) {
      const n = row._count._all;
      stats.total += n;
      if (row.status === "PENDING") stats.pending = n;
      else if (row.status === "APPROVED") stats.approved = n;
      else if (row.status === "REJECTED") stats.rejected = n;
      else if (row.status === "CANCELLED") stats.cancelled = n;
    }

    return ok(stats);
  } catch {
    return err("Internal server error", 500);
  }
}
