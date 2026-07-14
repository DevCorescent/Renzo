// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Management — Services
// ROUTE  : /api/v1/admin/workers/[id]/services
//
// METHODS
// GET    - List the services this worker is able to perform
// PUT    - Replace the worker's assigned services
//
// ACCESS
// GET    - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// PUT    - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "@/types/api";

/**
 * The shape both methods return, so a PUT response is byte-identical to a
 * subsequent GET — the client never has to reconcile two views of the same list.
 */
const WORKER_SERVICE_SELECT = {
  id: true,
  isActive: true,
  service: {
    select: {
      id: true,
      name: true,
      slug: true,
      image: true,
      basePrice: true,
      duration: true,
      isActive: true,
      category: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.WorkerServiceSelect;

/**
 * Ordered by service name, with the join-row id as a tiebreaker: two services
 * can share a name across categories, and without a deterministic second key the
 * list would reshuffle between requests.
 */
const WORKER_SERVICE_ORDER: Prisma.WorkerServiceOrderByWithRelationInput[] = [
  { service: { name: "asc" } },
  { id: "asc" },
];

/**
 * Resolve whether the caller may touch this worker at all.
 *
 * Mirrors the guard established in Worker CRUD so the isolation rule stays in one
 * shape across the module: branch membership is read from the persisted
 * WorkerBranch rows, never from the path, body or query, all of which the caller
 * controls. Returns an err() response in place of the record when access is
 * refused, matching requireAuth's `{ value, error }` convention.
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
   GET /api/v1/admin/workers/[id]/services — Services this worker can perform

   Drives the worker's service-assignment panel, and is the same mapping the
   booking flow consults to decide who may be assigned to a given service.
============================================================================ */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;

    const { error: accessError } = await authorizeWorkerAccess(user, id);
    if (accessError) return accessError;

    const services = await prisma.workerService.findMany({
      where: { workerId: id },
      orderBy: WORKER_SERVICE_ORDER,
      select: WORKER_SERVICE_SELECT,
    });

    return ok(services, "Worker services fetched successfully");
  } catch {
    return err("Internal server error", 500);
  }
}

/* ============================================================================
   PUT /api/v1/admin/workers/[id]/services — Replace the worker's services

   Replace-all semantics, matching the pattern already used for worker skills: the
   payload is the complete desired set, not a delta.

   Every id is resolved against the catalogue BEFORE anything is written. A bad id
   would otherwise only surface as a foreign-key violation after the deleteMany
   had already run — inside a transaction that then rolls back, so the data
   survives, but the caller gets an opaque error instead of being told which id
   was wrong.

   An inactive service, or one whose category has been deactivated, is refused:
   the same predicate the public catalogue uses to decide what is bookable, so a
   worker can never be assigned something a customer cannot book.

   NOTE ON BRANCH: services are a GLOBAL catalogue in this schema — WorkerProfile
   and Service have no branch column between them, and a branch opts into a
   service through ServiceBranchPricing, which is a pricing override rather than a
   membership record. There is therefore no "service belongs to another branch"
   condition to enforce here; branch isolation is applied to the WORKER, above.
============================================================================ */

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (body === null) {
      return err("Invalid JSON body", 400);
    }

    // Accepted as a bare array or as { serviceIds: [...] } — the existing
    // contract, preserved.
    const raw: unknown = Array.isArray(body)
      ? body
      : (body as { serviceIds?: unknown }).serviceIds;

    if (!Array.isArray(raw)) {
      return err("Validation failed", 422, {
        serviceIds: ["Expected an array of service IDs"],
      });
    }

    if (raw.some((s) => typeof s !== "string" || !s.trim())) {
      return err("Validation failed", 422, {
        serviceIds: ["Every entry must be a non-empty service ID"],
      });
    }

    const serviceIds = (raw as string[]).map((s) => s.trim());

    // A duplicate id is a malformed request, not something to silently collapse:
    // skipDuplicates would swallow it and the caller would never learn their
    // payload was wrong.
    const duplicates = [
      ...new Set(serviceIds.filter((s, i) => serviceIds.indexOf(s) !== i)),
    ];
    if (duplicates.length) {
      return err("Validation failed", 422, {
        serviceIds: [`Duplicate service IDs: ${duplicates.join(", ")}`],
      });
    }

    const { error: accessError } = await authorizeWorkerAccess(user, id);
    if (accessError) return accessError;

    // An empty array is a legitimate instruction — it clears every assignment —
    // so the catalogue lookup is skipped rather than the request refused.
    if (serviceIds.length) {
      const found = await prisma.service.findMany({
        where: { id: { in: serviceIds } },
        select: {
          id: true,
          isActive: true,
          category: { select: { isActive: true } },
        },
      });

      const foundIds = new Set(found.map((s) => s.id));
      const missing = serviceIds.filter((s) => !foundIds.has(s));
      if (missing.length) {
        return err("Validation failed", 422, {
          serviceIds: [`Unknown service IDs: ${missing.join(", ")}`],
        });
      }

      const inactive = found
        .filter((s) => !s.isActive || !s.category.isActive)
        .map((s) => s.id);
      if (inactive.length) {
        return err("Validation failed", 422, {
          serviceIds: [`Inactive service IDs: ${inactive.join(", ")}`],
        });
      }
    }

    // Clear, re-insert and read back in one transaction, so a concurrent GET can
    // never observe the worker mid-swap with an empty service list.
    const services = await prisma.$transaction(async (tx) => {
      await tx.workerService.deleteMany({ where: { workerId: id } });

      if (serviceIds.length) {
        await tx.workerService.createMany({
          data: serviceIds.map((serviceId) => ({ workerId: id, serviceId })),
          // Belt-and-braces against the [workerId, serviceId] unique constraint:
          // the duplicate check above already rejects them, so this can only fire
          // on a race, and dropping the row is the correct outcome either way.
          skipDuplicates: true,
        });
      }

      return tx.workerService.findMany({
        where: { workerId: id },
        orderBy: WORKER_SERVICE_ORDER,
        select: WORKER_SERVICE_SELECT,
      });
    });

    return ok(services, "Services updated");
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      switch (e.code) {
        // Only reachable if a service is deleted between validation and the
        // write — the pre-flight above turns every other bad id into a 422.
        case "P2003":
          return err("Validation failed", 422, {
            serviceIds: ["One or more service IDs no longer exist"],
          });
        case "P2025":
          return err("Worker not found", 404);
      }
    }
    return err("Internal server error", 500);
  }
}
