// ============================================================================
// OWNER  : Gauransh
// MODULE : Leave Management (admin)
// ROUTE  : /api/v1/admin/leaves/[id]/approve
//
// METHOD: POST — Approve a pending leave request.
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN.
//
// Mirrors admin/reviews/[id]/approve exactly (same verb, roles, envelope) and
// writes the approval fields the Leave model already carries: status, approvedBy,
// approvedAt. No new columns, no new tables.
//
// Two guards, in order:
//   1. Branch isolation — a BRANCH_ADMIN may only act on a worker in their own
//      branch. Leave has no branchId, so the check goes through the worker
//      (denyIfWorkerOutOfScope), which answers 404 for an out-of-scope worker so
//      the id cannot be used to probe other branches.
//   2. State — only a PENDING request can be approved; anything else is 409, so a
//      double click or a race cannot re-approve or flip a rejected request.
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, denyIfWorkerOutOfScope } from "@/lib/branch-scope";
import prisma from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const { id } = await params;

    const leave = await prisma.leave.findUnique({
      where: { id },
      select: { id: true, status: true, workerId: true },
    });
    if (!leave) return err("Leave request not found", 404);

    const denied = await denyIfWorkerOutOfScope(prisma, leave.workerId, scope);
    if (denied) return denied;

    if (leave.status !== "PENDING") {
      return err("Only pending leave requests can be approved", 409);
    }

    const updated = await prisma.leave.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedBy: user.userId,
        approvedAt: new Date(),
        // Clear any prior rejection note so an approved row carries no stale reason.
        rejectionReason: null,
      },
      include: { leaveType: true },
    });

    return ok(updated, "Leave approved");
  } catch {
    return err("Internal server error", 500);
  }
}
