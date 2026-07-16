import { NextRequest } from "next/server";
import type { Prisma, PortfolioChangeType } from "@prisma/client";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { resolveWorkerId } from "@/lib/worker-scope";
import { isChangeType, validatePayload, snapshotPrevious, notifyWorker, TYPE_LABELS } from "@/lib/portfolio-requests";
import { notifyBranchAdmins } from "@/lib/notifications";
import { writeAudit } from "@/lib/audit";
import prisma from "@/lib/db";

// Sections that hold a SINGLE live value — a worker may have only one pending change
// to each at a time (SKILL_LEVEL is deduped per-skill below; new-skill and gallery
// additions are legitimately repeatable, so they are not capped here).
const SINGLETON_TYPES: PortfolioChangeType[] = ["BIO", "EXPERIENCE", "LANGUAGE", "CERTIFICATE"];

// OWNER: Gauransh | MODULE: Worker Portfolio — Change Requests
// ROUTE : /api/v1/worker/portfolio-requests
//
// METHODS
//   GET  — The worker's own requests, for the "Portfolio Requests" tracker.
//   POST — Submit a professional change for approval. This NEVER touches the live
//          portfolio; it only records a PENDING request. The change goes live only
//          when a Branch Admin approves it (see admin/portfolio-requests/[id]).
//
// ACCESS: WORKER (own record only). workerId comes from the JWT, never the body.

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "NEEDS_CHANGES"];

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url);
    const statusParam = url.searchParams.get("status");
    const status = statusParam && STATUSES.includes(statusParam) ? statusParam : undefined;

    const where: Prisma.PortfolioChangeRequestWhereInput = {
      workerId,
      ...(status ? { status: status as never } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.portfolioChangeRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.portfolioChangeRequest.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    if (!isChangeType(body.type)) return err("Unknown request type", 422, { type: ["Unknown request type"] });
    const type = body.type as PortfolioChangeType;
    const payload = (body.payload && typeof body.payload === "object" ? body.payload : {}) as Record<string, unknown>;

    const check = validatePayload(type, payload);
    if (!check.ok) return err("Validation failed", 422, check.errors);

    // A skill request must reference a real skill — reject a bad id up front rather
    // than letting the FK blow up at approval time.
    if (type === "SKILL" || type === "SKILL_LEVEL") {
      const skill = await prisma.skill.findUnique({ where: { id: String(payload.skillId) }, select: { id: true } });
      if (!skill) return err("Validation failed", 422, { skillId: ["That skill no longer exists"] });
    }

    // DUPLICATE-PENDING GUARD. A section already awaiting review must not be
    // resubmitted — one open request per section keeps the approval queue clean and
    // matches the UI, which disables Edit while a section is pending.
    if (SINGLETON_TYPES.includes(type)) {
      const dupe = await prisma.portfolioChangeRequest.findFirst({
        where: { workerId, type, status: "PENDING" },
        select: { id: true },
      });
      if (dupe) return err(`You already have a pending ${TYPE_LABELS[type]} change awaiting review`, 409);
    } else if (type === "SKILL_LEVEL") {
      // Per-skill: two pending level changes to the SAME skill make no sense.
      const skillId = String(payload.skillId);
      const pending = await prisma.portfolioChangeRequest.findMany({
        where: { workerId, type: "SKILL_LEVEL", status: "PENDING" },
        select: { payload: true },
      });
      if (pending.some((p) => (p.payload as Record<string, unknown>)?.skillId === skillId)) {
        return err("You already have a pending level change for this skill", 409);
      }
    }

    // Gallery images travel as attachments too, so the admin drawer can preview them.
    const attachments =
      type === "GALLERY"
        ? [payload.beforeImage, payload.afterImage].filter((v): v is string => typeof v === "string" && v !== "")
        : [];

    // The worker's primary branch drives the Branch Admin alert.
    const primaryBranch = await prisma.workerBranch.findFirst({
      where: { workerId, isActive: true },
      orderBy: { isPrimary: "desc" },
      select: { branchId: true },
    });

    const request = await prisma.$transaction(async (tx) => {
      const previousValue = await snapshotPrevious(tx, workerId, type, payload);
      const newRequest = await tx.portfolioChangeRequest.create({
        data: {
          workerId,
          type,
          status: "PENDING",
          payload: payload as Prisma.InputJsonValue,
          ...(previousValue !== undefined ? { previousValue } : {}),
          attachments,
        },
      });

      // Reuse the existing engines: NotificationLog for the worker, the in-app
      // Notification for the reviewing Branch Admins, AuditLog for history. The live
      // portfolio is untouched — this only records a PENDING request.
      await notifyWorker(tx, workerId, "PORTFOLIO_REQUEST_SUBMITTED", `Your ${TYPE_LABELS[type]} change was submitted for approval.`, newRequest.id);
      if (primaryBranch?.branchId) {
        await notifyBranchAdmins(primaryBranch.branchId, {
          type: "INFO",
          title: "New portfolio change request",
          message: `A worker submitted a ${TYPE_LABELS[type]} change for review.`,
          href: "/branch-admin/portfolio-requests",
          refType: "PortfolioChangeRequest",
          refId: newRequest.id,
        }, tx);
      }
      await writeAudit(user, { action: "CREATE", module: "PORTFOLIO", refId: newRequest.id, refType: "PortfolioChangeRequest", newValue: { type } }, tx);

      return newRequest;
    });

    return created(request, "Submitted for approval");
  } catch {
    return err("Internal server error", 500);
  }
}
