import { NextRequest } from "next/server";
import { PortfolioCategory } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { resolveWorkerId } from "@/lib/worker-scope";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Worker Portfolio
// ROUTE  : /api/v1/worker/portfolio/[id]
// METHODS: PATCH  — Edit own gallery item.
//          DELETE — Remove own gallery item.
// ACCESS : WORKER (own items only).
//
// SECURITY / BRANCH ISOLATION
//   Ownership is enforced in the WRITE itself: every mutation is scoped by
//   { id, workerId } where workerId comes from the JWT. A worker can only ever
//   touch their own item, and an id belonging to someone else answers 404 (not
//   403) so it cannot be used to prove another worker's item exists.
//
// RE-APPROVAL RULE
//   Editing the CONTENT of an item (image, category or caption) clears its
//   approval so an admin re-reviews before it is shown again — a worker must not be
//   able to swap an approved image for an unvetted one. Re-ordering (sortOrder
//   only) is display-only and leaves approval untouched.

const CATEGORIES = new Set<string>(Object.values(PortfolioCategory));

// The fields whose change means the item must be re-approved.
const CONTENT_FIELDS = ["title", "description", "category", "beforeImage", "afterImage"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const errors: Record<string, string[]> = {};
    const data: Record<string, unknown> = {};

    if (body.title !== undefined) data.title = body.title === null ? null : String(body.title).trim();
    if (body.description !== undefined) {
      data.description = body.description === null ? null : String(body.description).trim();
    }
    if (body.beforeImage !== undefined) {
      data.beforeImage = body.beforeImage === null ? null : String(body.beforeImage).trim();
    }

    // afterImage is required on the model, so it may be changed but never blanked.
    if (body.afterImage !== undefined) {
      const after = String(body.afterImage).trim();
      if (!after) errors.afterImage = ["afterImage cannot be empty"];
      else data.afterImage = after;
    }

    if (body.category !== undefined) {
      if (!CATEGORIES.has(body.category)) {
        errors.category = [`category must be one of ${[...CATEGORIES].join(", ")}`];
      } else {
        data.category = body.category;
      }
    }

    if (body.sortOrder !== undefined) {
      const n = Number(body.sortOrder);
      if (!Number.isInteger(n) || n < 0) errors.sortOrder = ["sortOrder must be a non-negative integer"];
      else data.sortOrder = n;
    }

    if (Object.keys(errors).length) return err("Validation failed", 422, errors);
    if (Object.keys(data).length === 0) return err("No updatable fields provided", 422);

    // Any content change sends the item back to pending so an admin re-reviews it.
    const contentChanged = CONTENT_FIELDS.some((f) => f in data);
    if (contentChanged) {
      data.isApproved = false;
      data.approvedBy = null;
      data.approvedAt = null;
    }

    // Ownership guard IS the write filter — updateMany only touches a row that is
    // both this id AND this worker's, atomically. count 0 ⇒ not theirs (or gone).
    const result = await prisma.workerPortfolio.updateMany({
      where: { id, workerId },
      data,
    });
    if (result.count === 0) return err("Portfolio item not found", 404);

    const item = await prisma.workerPortfolio.findUnique({ where: { id } });
    return ok(item, contentChanged ? "Portfolio item updated, pending re-approval" : "Portfolio item updated");
  } catch {
    return err("Internal server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const { id } = await params;

    // Atomic ownership-scoped delete: a foreign id simply matches nothing → 404.
    // WorkerPortfolio owns no child rows, so this leaves nothing orphaned.
    const result = await prisma.workerPortfolio.deleteMany({ where: { id, workerId } });
    if (result.count === 0) return err("Portfolio item not found", 404);

    return ok(null, "Portfolio item deleted");
  } catch {
    return err("Internal server error", 500);
  }
}
