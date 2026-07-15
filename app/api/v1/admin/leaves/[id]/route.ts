// ============================================================================
// OWNER  : Gauransh
// MODULE : Leave Management (admin)
// ROUTE  : /api/v1/admin/leaves/[id]
//
// METHODS
//   GET   — Full detail for one leave request.
//   PATCH — Approve or reject a PENDING request: body { status: "APPROVED" | "REJECTED" }.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN.
//
// BRANCH ISOLATION
//   Leave has NO branchId — a leave belongs to a worker, whose branch lives in the
//   WorkerBranch join table. So access is guarded THROUGH the worker with
//   denyIfWorkerOutOfScope(), which answers 404 for an out-of-scope worker so an id
//   cannot be used to probe another branch. Same primitive the Workers module uses.
//
// FIELDS WRITTEN
//   PATCH updates ONLY `status`. No approvedBy / approvedAt / rejectionReason is
//   touched — the transition is a pure status change, per the module's design.
// ============================================================================

import { NextRequest } from "next/server";
import type { LeaveStatus } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, denyIfWorkerOutOfScope } from "@/lib/branch-scope";
import prisma from "@/lib/db";

// The only two states a PENDING request may be moved to from this endpoint.
const TARGET_STATUSES = ["APPROVED", "REJECTED"] as const;
type TargetStatus = (typeof TARGET_STATUSES)[number];

// GET /api/v1/admin/leaves/[id] — Full leave detail.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const { id } = await params;

    const leave = await prisma.leave.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        days: true,
        reason: true,
        createdAt: true,
        leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            employeeCode: true,
            profilePhoto: true,
            designation: { select: { name: true } },
            branches: {
              where: { isActive: true },
              select: { isPrimary: true, branch: { select: { id: true, name: true, code: true } } },
            },
          },
        },
      },
    });
    if (!leave) return err("Leave request not found", 404);

    // Guard by the leave's worker — 404 (not 403) so it can't confirm a leave
    // exists in another branch.
    const denied = await denyIfWorkerOutOfScope(prisma, leave.worker.id, scope);
    if (denied) return denied;

    return ok(leave);
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/leaves/[id] — Approve or reject a pending leave.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const status = body.status as TargetStatus | undefined;
    if (!status || !TARGET_STATUSES.includes(status)) {
      return err("Validation failed", 422, {
        status: [`status must be one of: ${TARGET_STATUSES.join(", ")}`],
      });
    }

    const leave = await prisma.leave.findUnique({
      where: { id },
      select: { id: true, status: true, workerId: true },
    });
    if (!leave) return err("Leave request not found", 404);

    const denied = await denyIfWorkerOutOfScope(prisma, leave.workerId, scope);
    if (denied) return denied;

    // Only a PENDING request may transition. Reject an already-actioned one up
    // front with a clear message…
    if (leave.status !== "PENDING") {
      return err(`This leave request has already been ${leave.status.toLowerCase()}`, 409);
    }

    // …and guard the write itself against a race: two admins clicking Approve at
    // the same moment both pass the check above, so the transition is an atomic
    // compare-and-swap — updateMany only touches the row while it is STILL pending.
    // The loser sees count 0 and is told it was already actioned, so no double
    // approval can land.
    const result = await prisma.leave.updateMany({
      where: { id, status: "PENDING" },
      data: { status: status as LeaveStatus },
    });
    if (result.count === 0) {
      return err("This leave request has already been actioned", 409);
    }

    const updated = await prisma.leave.findUnique({
      where: { id },
      include: { leaveType: true },
    });

    return ok(updated, status === "APPROVED" ? "Leave approved" : "Leave rejected");
  } catch {
    return err("Internal server error", 500);
  }
}
