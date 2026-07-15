// ============================================================================
// OWNER  : Gauransh
// MODULE : Leave Management (admin)
// ROUTE  : /api/v1/admin/leaves/[id]/reject
//
// METHOD: POST — Reject a pending leave request, with an optional reason.
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN.
//
// Mirrors admin/reviews/[id]/reject exactly. `rejectionReason` is a real, nullable
// column on Leave, so the reason is stored when given and left null otherwise —
// never invented, never required. Same branch-isolation + PENDING-only guards as
// approve.
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

    const body = await req.json().catch(() => null);
    const reason: string =
      body && typeof body.reason === "string" ? body.reason.trim() : "";

    const leave = await prisma.leave.findUnique({
      where: { id },
      select: { id: true, status: true, workerId: true },
    });
    if (!leave) return err("Leave request not found", 404);

    const denied = await denyIfWorkerOutOfScope(prisma, leave.workerId, scope);
    if (denied) return denied;

    if (leave.status !== "PENDING") {
      return err("Only pending leave requests can be rejected", 409);
    }

    const updated = await prisma.leave.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason: reason || null,
        approvedBy: user.userId,
        approvedAt: new Date(),
      },
      include: { leaveType: true },
    });

    return ok(updated, "Leave rejected");
  } catch {
    return err("Internal server error", 500);
  }
}
