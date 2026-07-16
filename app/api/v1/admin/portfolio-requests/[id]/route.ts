import { NextRequest } from "next/server";
import type { Prisma, PortfolioChangeType } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, denyIfWorkerOutOfScope } from "@/lib/branch-scope";
import { applyApprovedChange, notifyWorker, TYPE_LABELS } from "@/lib/portfolio-requests";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Admin — Portfolio Change Requests
// ROUTE : /api/v1/admin/portfolio-requests/[id]
//
// METHODS
//   GET   — Full request detail (worker + payload + previousValue) for the drawer.
//   PATCH — Review it: { action: "APPROVE" | "REJECT" | "NEEDS_CHANGES", reviewNote }.
//           APPROVE applies the change to the LIVE portfolio, atomically. Reject and
//           request-changes require a note. History → AuditLog; worker alert →
//           NotificationLog.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN.
// BRANCH ISOLATION: guarded through the worker (denyIfWorkerOutOfScope), which
// answers 404 for an out-of-branch worker so an id can't probe another branch.

const ACTIONS = ["APPROVE", "REJECT", "NEEDS_CHANGES"] as const;
type Action = (typeof ACTIONS)[number];

const NEXT_STATUS: Record<Action, "APPROVED" | "REJECTED" | "NEEDS_CHANGES"> = {
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  NEEDS_CHANGES: "NEEDS_CHANGES",
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const { id } = await params;
    const request = await prisma.portfolioChangeRequest.findUnique({
      where: { id },
      include: {
        worker: {
          select: {
            id: true, firstName: true, lastName: true, displayName: true, employeeCode: true,
            profilePhoto: true, experience: true, designation: { select: { name: true } },
            ratingSummary: { select: { averageRating: true, totalReviews: true } },
            branches: { where: { isActive: true }, select: { isPrimary: true, branch: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    if (!request) return err("Request not found", 404);

    const denied = await denyIfWorkerOutOfScope(prisma, request.workerId, scope);
    if (denied) return denied;

    return ok(request);
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

    const action = body.action as Action | undefined;
    if (!action || !ACTIONS.includes(action)) {
      return err("Validation failed", 422, { action: [`action must be one of: ${ACTIONS.join(", ")}`] });
    }
    const reviewNote = typeof body.reviewNote === "string" ? body.reviewNote.trim() : "";
    if ((action === "REJECT" || action === "NEEDS_CHANGES") && !reviewNote) {
      return err("Validation failed", 422, { reviewNote: ["A note is required to reject or request changes"] });
    }

    const request = await prisma.portfolioChangeRequest.findUnique({
      where: { id },
      select: { id: true, workerId: true, status: true, type: true, payload: true, previousValue: true },
    });
    if (!request) return err("Request not found", 404);

    const denied = await denyIfWorkerOutOfScope(prisma, request.workerId, scope);
    if (denied) return denied;

    // Only a PENDING request may be actioned — a decided one is final (the worker
    // submits a fresh request). This also blocks a double-approve race.
    if (request.status !== "PENDING") {
      return err(`This request has already been ${request.status.toLowerCase().replace("_", " ")}`, 409);
    }

    const type = request.type as PortfolioChangeType;
    const label = TYPE_LABELS[type];

    const updated = await prisma.$transaction(async (tx) => {
      // Compare-and-swap on the PENDING status: the loser of a concurrent review
      // touches zero rows and we abort, so a change can never be applied twice.
      const swap = await tx.portfolioChangeRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: NEXT_STATUS[action], reviewedBy: user.userId, reviewedAt: new Date(), reviewNote: reviewNote || null },
      });
      if (swap.count === 0) throw new Error("ALREADY_ACTIONED");

      if (action === "APPROVE") {
        await applyApprovedChange(tx, request.workerId, type, request.payload as Record<string, unknown>, user.userId);
      }

      await tx.auditLog.create({
        data: {
          userId: user.userId,
          userType: user.userType,
          action: action === "NEEDS_CHANGES" ? "REQUEST_CHANGES" : action,
          module: "PORTFOLIO",
          refId: id,
          refType: "PortfolioChangeRequest",
          ...(request.previousValue != null ? { oldValue: request.previousValue as Prisma.InputJsonValue } : {}),
          newValue: request.payload as Prisma.InputJsonValue,
        },
      });

      const message =
        action === "APPROVE"
          ? `Your ${label} update was approved and is now live.`
          : action === "REJECT"
            ? `Your ${label} update was rejected. Reason: ${reviewNote}`
            : `Changes requested on your ${label} update: ${reviewNote}`;
      await notifyWorker(tx, request.workerId, `PORTFOLIO_REQUEST_${NEXT_STATUS[action]}`, message, id);

      return tx.portfolioChangeRequest.findUnique({ where: { id } });
    });

    const verb = action === "APPROVE" ? "approved" : action === "REJECT" ? "rejected" : "returned for changes";
    return ok(updated, `Request ${verb}`);
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_ACTIONED") {
      return err("This request has already been actioned", 409);
    }
    return err("Internal server error", 500);
  }
}
