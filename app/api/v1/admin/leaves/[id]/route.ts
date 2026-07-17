// ============================================================================
// OWNER  : Gauransh
// MODULE : Leave Management (admin)
// ROUTE  : /api/v1/admin/leaves/[id]
//
// METHODS
//   GET   — Full detail for one leave request.
//   PATCH — Status transitions:
//             PENDING|CANCELLED → APPROVED|REJECTED
//             CANCELLED → PENDING (reopen)
//             APPROVED → CANCELLED (admin cancel)
//           Body: { status, rejectionReason? }
// ============================================================================

import { NextRequest } from "next/server";
import type { LeaveStatus } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, denyIfWorkerOutOfScope } from "@/lib/branch-scope";
import prisma from "@/lib/db";
import { adjustLeaveBalance } from "@/lib/leave-balance";

const ALLOWED: Record<LeaveStatus, LeaveStatus[]> = {
  PENDING: ["APPROVED", "REJECTED", "CANCELLED"],
  CANCELLED: ["APPROVED", "REJECTED", "PENDING"],
  APPROVED: ["CANCELLED"],
  REJECTED: [],
};

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
        rejectionReason: true,
        approvedBy: true,
        approvedAt: true,
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

    const denied = await denyIfWorkerOutOfScope(prisma, leave.worker.id, scope);
    if (denied) return denied;

    return ok(leave);
  } catch {
    return err("Internal server error", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const status = body.status as LeaveStatus | undefined;
    if (!status || !(status in ALLOWED)) {
      return err("Validation failed", 422, {
        status: ["status must be APPROVED, REJECTED, PENDING, or CANCELLED"],
      });
    }

    const rejectionReason =
      typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : undefined;

    const leave = await prisma.leave.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        workerId: true,
        leaveTypeId: true,
        days: true,
        startDate: true,
      },
    });
    if (!leave) return err("Leave request not found", 404);

    const denied = await denyIfWorkerOutOfScope(prisma, leave.workerId, scope);
    if (denied) return denied;

    const allowedTargets = ALLOWED[leave.status];
    if (!allowedTargets.includes(status)) {
      return err(
        `Cannot move leave from ${leave.status} to ${status}`,
        409
      );
    }

    if (status === "REJECTED" && !rejectionReason) {
      // rejectionReason optional but preferred — allow empty
    }

    const year = leave.startDate.getUTCFullYear();
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.leave.updateMany({
        where: { id, status: leave.status },
        data: {
          status,
          ...(status === "APPROVED"
            ? {
                approvedBy: user.userId,
                approvedAt: now,
                rejectionReason: null,
              }
            : {}),
          ...(status === "REJECTED"
            ? {
                approvedBy: user.userId,
                approvedAt: now,
                rejectionReason: rejectionReason || null,
              }
            : {}),
          ...(status === "PENDING"
            ? {
                approvedBy: null,
                approvedAt: null,
                rejectionReason: null,
              }
            : {}),
          ...(status === "CANCELLED"
            ? {
                // keep prior approval audit if any
              }
            : {}),
        },
      });
      if (result.count === 0) {
        throw new Error("RACE");
      }

      await adjustLeaveBalance(tx, {
        workerId: leave.workerId,
        leaveTypeId: leave.leaveTypeId,
        days: leave.days,
        year,
        from: leave.status,
        to: status,
      });

      return tx.leave.findUnique({
        where: { id },
        include: { leaveType: true },
      });
    });

    const messages: Record<string, string> = {
      APPROVED: "Leave approved",
      REJECTED: "Leave rejected",
      PENDING: "Leave reopened",
      CANCELLED: "Leave cancelled",
    };

    return ok(updated, messages[status] ?? "Leave updated");
  } catch (e) {
    if (e instanceof Error && e.message === "RACE") {
      return err("This leave request has already been actioned", 409);
    }
    return err("Internal server error", 500);
  }
}
