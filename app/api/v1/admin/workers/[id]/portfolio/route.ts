// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Management — Portfolio
// ROUTE  : /api/v1/admin/workers/[id]/portfolio
//
// METHODS
// GET    - List portfolio items
// POST   - Create portfolio item
// PATCH  - Approve or reject a portfolio item
//
// ACCESS
// GET    - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// POST   - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// PATCH  - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// ============================================================================

import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { Prisma, PortfolioCategory } from "@prisma/client";
import type { AuthUser } from "@/types/api";

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;

// Images are either an absolute http(s) URL — what POST /api/v1/upload returns
// from R2 — or a root-relative path served by the app itself. Anything else is a
// client bug, and storing it would surface later as a broken public profile.
const IMAGE_RE = /^(https?:\/\/|\/)\S+$/;

/**
 * The shape every method returns, so a POST or PATCH response is byte-identical
 * to a subsequent GET — the frontend never needs a second DTO for the same row.
 */
const PORTFOLIO_SELECT = {
  id: true,
  category: true,
  title: true,
  description: true,
  beforeImage: true,
  afterImage: true,
  isApproved: true,
  approvedBy: true,
  approvedAt: true,
  sortOrder: true,
  createdAt: true,
} satisfies Prisma.WorkerPortfolioSelect;

/**
 * Newest first, with the id as a tiebreaker: items bulk-created in one request
 * share a createdAt to the millisecond, and without a deterministic second key
 * they would reshuffle between pages — showing one item twice and skipping
 * another.
 */
const PORTFOLIO_ORDER: Prisma.WorkerPortfolioOrderByWithRelationInput[] = [
  { createdAt: "desc" },
  { id: "asc" },
];

/**
 * Resolve whether the caller may touch this worker at all.
 *
 * Mirrors the guard established in Worker CRUD, Services and Skills so the
 * isolation rule stays in one shape across the module: branch membership is read
 * from the persisted WorkerBranch rows, never from the path, body or query, all
 * of which the caller controls. Returns an err() response in place of the record
 * when access is refused, matching requireAuth's `{ value, error }` convention.
 */
async function authorizeWorkerAccess(
  user: AuthUser,
  id: string
): Promise<
  | { worker: { id: string }; error: null }
  | { worker: null; error: ReturnType<typeof err> }
> {
  // Deny by default: a branch-scoped account with no branch must never fall
  // through to an unscoped read or write.
  if (user.userType === "BRANCH_ADMIN" && !user.branchId) {
    return {
      worker: null,
      error: err("Your account is not assigned to a branch", 403),
    };
  }

  const worker = await prisma.workerProfile.findUnique({
    where: { id },
    select: {
      id: true,
      branches: { select: { branchId: true, isActive: true } },
    },
  });

  if (!worker) {
    return { worker: null, error: err("Worker not found", 404) };
  }

  if (
    user.userType === "BRANCH_ADMIN" &&
    !worker.branches.some((b) => b.branchId === user.branchId && b.isActive)
  ) {
    return {
      worker: null,
      error: err("Forbidden — worker belongs to another branch", 403),
    };
  }

  return { worker: { id: worker.id }, error: null };
}

/* ============================================================================
   GET /api/v1/admin/workers/[id]/portfolio — Portfolio items

   Serves two views off the same route: the worker's full body of work, and — via
   ?approved=false — the moderation queue an admin works through before anything
   reaches the public stylist profile.
============================================================================ */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);

    const { error: accessError } = await authorizeWorkerAccess(user, id);
    if (accessError) return accessError;

    // Tri-state: absent means "every item", not "unapproved".
    const approved = url.searchParams.get("approved");
    const category = url.searchParams.get("category") as PortfolioCategory | null;

    const where: Prisma.WorkerPortfolioWhereInput = {
      workerId: id,
      ...(approved === "true" || approved === "false"
        ? { isApproved: approved === "true" }
        : {}),
      ...(category && Object.values(PortfolioCategory).includes(category)
        ? { category }
        : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.workerPortfolio.findMany({
        where,
        skip,
        take: limit,
        orderBy: PORTFOLIO_ORDER,
        select: PORTFOLIO_SELECT,
      }),
      prisma.workerPortfolio.count({ where }),
    ]);

    return paginated(items, total, page, limit, "Worker portfolio fetched successfully");
  } catch {
    return err("Internal server error", 500);
  }
}

/* ============================================================================
   POST /api/v1/admin/workers/[id]/portfolio — Create a portfolio item

   Creates a single item on the worker's behalf. Portfolio history is append-only:
   there is no update or delete here, because a worker's past work is evidence
   used by the booking and marketing surfaces and must not be quietly rewritten.

   An item is ALWAYS created unapproved, even when an admin is the author. The
   public stylist profile renders approved items only, so approval stays a
   deliberate second action rather than a side effect of creation — otherwise the
   moderation gate could be bypassed simply by posting through this route instead
   of the worker's own.
============================================================================ */

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return err("Invalid JSON body", 400);
    }

    const { error: accessError } = await authorizeWorkerAccess(user, id);
    if (accessError) return accessError;

    const errors: Record<string, string[]> = {};

    // Category and afterImage are the two columns the schema requires — an item
    // with no "after" shot is not a portfolio entry, and an uncategorised one
    // cannot be filtered on any surface that consumes it.
    const category = body.category as PortfolioCategory;
    if (!category || !Object.values(PortfolioCategory).includes(category)) {
      errors.category = [
        `Category must be one of: ${Object.values(PortfolioCategory).join(", ")}`,
      ];
    }

    const afterImage =
      typeof body.afterImage === "string" ? body.afterImage.trim() : "";
    if (!afterImage) {
      errors.afterImage = ["After image is required"];
    } else if (!IMAGE_RE.test(afterImage)) {
      errors.afterImage = ["After image must be an absolute http(s) URL or a root-relative path"];
    }

    // The before shot is optional — a colour correction has one, a fresh nail set
    // does not.
    let beforeImage: string | null = null;
    if (body.beforeImage != null && body.beforeImage !== "") {
      const value = typeof body.beforeImage === "string" ? body.beforeImage.trim() : "";
      if (!value || !IMAGE_RE.test(value)) {
        errors.beforeImage = ["Before image must be an absolute http(s) URL or a root-relative path"];
      } else {
        beforeImage = value;
      }
    }

    let title: string | null = null;
    if (body.title != null && body.title !== "") {
      const value = typeof body.title === "string" ? body.title.trim() : "";
      if (!value) {
        errors.title = ["Title cannot be blank"];
      } else if (value.length > MAX_TITLE_LENGTH) {
        errors.title = [`Title must be ${MAX_TITLE_LENGTH} characters or fewer`];
      } else {
        title = value;
      }
    }

    let description: string | null = null;
    if (body.description != null && body.description !== "") {
      const value = typeof body.description === "string" ? body.description.trim() : "";
      if (!value) {
        errors.description = ["Description cannot be blank"];
      } else if (value.length > MAX_DESCRIPTION_LENGTH) {
        errors.description = [
          `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`,
        ];
      } else {
        description = value;
      }
    }

    let sortOrder = 0;
    if (body.sortOrder != null && body.sortOrder !== "") {
      const value = Number(body.sortOrder);
      if (!Number.isInteger(value) || value < 0) {
        errors.sortOrder = ["Sort order must be a non-negative integer"];
      } else {
        sortOrder = value;
      }
    }

    if (Object.keys(errors).length) {
      return err("Validation failed", 422, errors);
    }

    const item = await prisma.workerPortfolio.create({
      data: {
        workerId: id,
        category,
        title,
        description,
        beforeImage,
        afterImage,
        sortOrder,
        // Never auto-publish. Approval is the separate, deliberate act below.
        isApproved: false,
      },
      select: PORTFOLIO_SELECT,
    });

    return created(item, "Portfolio item created — pending approval");
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      switch (e.code) {
        case "P2003":
          return err("Worker not found", 404);
        case "P2025":
          return err("Worker not found", 404);
      }
    }
    return err("Internal server error", 500);
  }
}

/* ============================================================================
   PATCH /api/v1/admin/workers/[id]/portfolio — Approve or reject an item

   The moderation gate. This is the only path in the system that sets
   isApproved — the worker's own upload endpoint creates items unapproved, and
   the public stylist profile renders approved items only — so removing it would
   silently take every worker portfolio off the public site.

   Rejecting clears the approval trail rather than recording who rejected it: the
   columns are approvedBy/approvedAt, and leaving a rejector's id in a field named
   "approvedBy" would misrepresent the audit record.
============================================================================ */

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return err("Invalid JSON body", 400);
    }

    const { error: accessError } = await authorizeWorkerAccess(user, id);
    if (accessError) return accessError;

    const errors: Record<string, string[]> = {};

    const portfolioId =
      typeof body.portfolioId === "string" ? body.portfolioId.trim() : "";
    if (!portfolioId) {
      errors.portfolioId = ["Portfolio item ID is required"];
    }
    if (typeof body.approve !== "boolean") {
      errors.approve = ["Approve must be a boolean"];
    }

    if (Object.keys(errors).length) {
      return err("Validation failed", 422, errors);
    }

    // Scoped by workerId as well as id: without it, an admin authorised for this
    // worker could moderate an item belonging to a worker in another branch by
    // supplying its id.
    const existing = await prisma.workerPortfolio.findFirst({
      where: { id: portfolioId, workerId: id },
      select: { id: true },
    });
    if (!existing) {
      return err("Portfolio item not found for this worker", 404);
    }

    const approve = body.approve as boolean;

    const item = await prisma.workerPortfolio.update({
      where: { id: portfolioId },
      data: {
        isApproved: approve,
        approvedBy: approve ? user.userId : null,
        approvedAt: approve ? new Date() : null,
      },
      select: PORTFOLIO_SELECT,
    });

    return ok(item, approve ? "Portfolio item approved" : "Portfolio item rejected");
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return err("Portfolio item not found for this worker", 404);
    }
    return err("Internal server error", 500);
  }
}
