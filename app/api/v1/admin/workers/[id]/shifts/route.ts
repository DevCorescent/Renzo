// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Management — Shifts
// ROUTE  : /api/v1/admin/workers/[id]/shifts
//
// METHODS
// GET    - List assigned shifts
// PUT    - Replace assigned shift assignments
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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The shape both methods return, so a PUT response is byte-identical to a
 * subsequent GET — the frontend never needs a second DTO for the same row.
 *
 * The Shift template is expanded because an assignment is meaningless without the
 * hours it actually represents: an admin reading this list needs to see "Morning,
 * 09:00–18:00, Mon–Fri", not a foreign key.
 */
const WORKER_SHIFT_SELECT = {
  id: true,
  startDate: true,
  endDate: true,
  isActive: true,
  createdAt: true,
  shift: {
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
      breakStart: true,
      breakEnd: true,
      workingDays: true,
      isActive: true,
    },
  },
  branch: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
} satisfies Prisma.WorkerShiftSelect;

/**
 * Active assignments first, then the most recently effective — an admin opening
 * this list is looking at the roster in force today, not the one that lapsed last
 * year. The id tiebreaker keeps the order deterministic when a worker holds
 * several assignments starting on the same date, which happens whenever a roster
 * is replaced in a single request.
 */
const WORKER_SHIFT_ORDER: Prisma.WorkerShiftOrderByWithRelationInput[] = [
  { isActive: "desc" },
  { startDate: "desc" },
  { id: "asc" },
];

/**
 * Resolve whether the caller may touch this worker at all.
 *
 * Mirrors the guard established in Worker CRUD, Services, Skills, Portfolio and
 * Availability so the isolation rule stays in one shape across the module: branch
 * membership is read from the persisted WorkerBranch rows, never from the path,
 * body or query, all of which the caller controls. Returns an err() response in
 * place of the record when access is refused, matching requireAuth's
 * `{ value, error }` convention.
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
   GET /api/v1/admin/workers/[id]/shifts — Assigned shifts

   The worker's roster: which Shift template they work, at which branch, over
   which period. Attendance, leave and slot generation all read these assignments
   downstream; this route only maintains them.
============================================================================ */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;

    const { error: accessError } = await authorizeWorkerAccess(user, id);
    if (accessError) return accessError;

    const shifts = await prisma.workerShift.findMany({
      where: { workerId: id },
      orderBy: WORKER_SHIFT_ORDER,
      select: WORKER_SHIFT_SELECT,
    });

    return ok(shifts, "Worker shifts fetched successfully");
  } catch {
    return err("Internal server error", 500);
  }
}

/* ============================================================================
   PUT /api/v1/admin/workers/[id]/shifts — Replace the worker's assignments

   Replace-all semantics, matching Worker Skills and Worker Services: the payload
   is the complete desired roster, not a delta. An empty array is a legitimate
   instruction — it clears every assignment — and is accepted rather than refused.

   Every shift and branch is resolved BEFORE anything is written. A bad id would
   otherwise only surface as a foreign-key violation after the deleteMany had
   already run — inside a transaction that then rolls back, so the data survives,
   but the caller gets an opaque error instead of being told which id was wrong.

   NOTE: WorkerShift carries no unique constraint, so createMany's skipDuplicates
   would be a no-op here — nothing for the database to collapse on. Duplicates are
   therefore rejected outright in validation rather than silently dropped, which is
   the only place they can be caught at all.
============================================================================ */

type ShiftAssignment = {
  shiftId: string;
  branchId: string;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
};

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (body === null) {
      return err("Invalid JSON body", 400);
    }

    // Accepted as a bare array or as { shifts: [...] }, matching the payload
    // convention the sibling replace-all routes already use.
    const raw: unknown = Array.isArray(body)
      ? body
      : (body as { shifts?: unknown }).shifts;

    if (!Array.isArray(raw)) {
      return err("Validation failed", 422, {
        shifts: ["Expected an array of shift assignments"],
      });
    }

    const { error: accessError } = await authorizeWorkerAccess(user, id);
    if (accessError) return accessError;

    // A shift is worked AT a branch, so an assignment is only coherent for a
    // branch the worker actually belongs to. These links are the authority for
    // that — not the branchId in the body.
    const memberships = await prisma.workerBranch.findMany({
      where: { workerId: id, isActive: true },
      select: { branchId: true, isPrimary: true },
    });

    if (raw.length && !memberships.length) {
      return err(
        "Worker is not assigned to any branch, so shifts cannot be assigned",
        409
      );
    }

    const allowedBranchIds = new Set(memberships.map((m) => m.branchId));
    const defaultBranchId =
      memberships.find((m) => m.isPrimary)?.branchId ?? memberships[0]?.branchId;

    const assignments: ShiftAssignment[] = [];
    const errors: Record<string, string[]> = {};

    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      const at = `shifts[${i}]`;

      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        errors[at] = ["Each entry must be an object"];
        continue;
      }

      const entry = item as Record<string, unknown>;

      const shiftId = typeof entry.shiftId === "string" ? entry.shiftId.trim() : "";
      if (!shiftId) {
        errors[at] = ["shiftId is required"];
        continue;
      }

      // A branch admin can only ever roster inside their own branch, so the body's
      // branchId is ignored for them entirely. Platform roles name it explicitly,
      // falling back to the worker's primary branch when they don't — a worker
      // belongs to one branch, so that is unambiguous rather than a guess.
      const requestedBranchId =
        typeof entry.branchId === "string" ? entry.branchId.trim() : "";

      const branchId =
        user.userType === "BRANCH_ADMIN"
          ? user.branchId!
          : requestedBranchId || defaultBranchId;

      if (!branchId) {
        errors[at] = ["branchId is required"];
        continue;
      }

      if (!allowedBranchIds.has(branchId)) {
        errors[at] = ["Worker does not belong to the specified branch"];
        continue;
      }

      const rawStart = typeof entry.startDate === "string" ? entry.startDate.trim() : "";
      if (!rawStart) {
        errors[at] = ["startDate is required"];
        continue;
      }
      if (!DATE_RE.test(rawStart)) {
        errors[at] = ["startDate must be in YYYY-MM-DD format"];
        continue;
      }

      // Both bounds are pinned to UTC midnight: the columns are @db.Date, and the
      // Date constructor's string parsing would otherwise shift the day on any
      // server not running in UTC.
      const startDate = new Date(`${rawStart}T00:00:00.000Z`);
      if (Number.isNaN(startDate.getTime())) {
        errors[at] = ["startDate is not a valid date"];
        continue;
      }

      let endDate: Date | null = null;
      if (entry.endDate != null && entry.endDate !== "") {
        const rawEnd = typeof entry.endDate === "string" ? entry.endDate.trim() : "";
        if (!DATE_RE.test(rawEnd)) {
          errors[at] = ["endDate must be in YYYY-MM-DD format"];
          continue;
        }
        const parsed = new Date(`${rawEnd}T00:00:00.000Z`);
        if (Number.isNaN(parsed.getTime())) {
          errors[at] = ["endDate is not a valid date"];
          continue;
        }
        if (parsed < startDate) {
          errors[at] = ["endDate cannot be before startDate"];
          continue;
        }
        endDate = parsed;
      }

      if (entry.isActive !== undefined && typeof entry.isActive !== "boolean") {
        errors[at] = ["isActive must be a boolean"];
        continue;
      }

      assignments.push({
        shiftId,
        branchId,
        startDate,
        endDate,
        isActive: entry.isActive === undefined ? true : (entry.isActive as boolean),
      });
    }

    if (Object.keys(errors).length) {
      return err("Validation failed", 422, errors);
    }

    // An identical row twice is a malformed payload. The same shift may legitimately
    // recur at different periods — a stylist on Morning in January and again in
    // March — so the key is the whole assignment, not the shiftId alone; collapsing
    // on shiftId would forbid a schedule the schema explicitly supports.
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const a of assignments) {
      const key = `${a.shiftId}|${a.branchId}|${a.startDate.toISOString()}`;
      if (seen.has(key)) duplicates.add(a.shiftId);
      seen.add(key);
    }
    if (duplicates.size) {
      return err("Validation failed", 422, {
        shifts: [`Duplicate shift assignments: ${[...duplicates].join(", ")}`],
      });
    }

    // Skipped for an empty payload: there is nothing to resolve, and clearing the
    // roster is always valid.
    if (assignments.length) {
      const shiftIds = [...new Set(assignments.map((a) => a.shiftId))];
      const branchIds = [...new Set(assignments.map((a) => a.branchId))];

      const [shifts, branches] = await Promise.all([
        prisma.shift.findMany({
          where: { id: { in: shiftIds } },
          select: { id: true, isActive: true },
        }),
        prisma.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, isActive: true },
        }),
      ]);

      const foundShiftIds = new Set(shifts.map((s) => s.id));
      const missingShifts = shiftIds.filter((s) => !foundShiftIds.has(s));
      if (missingShifts.length) {
        return err("Validation failed", 422, {
          shifts: [`Unknown shift IDs: ${missingShifts.join(", ")}`],
        });
      }

      const inactiveShifts = shifts.filter((s) => !s.isActive).map((s) => s.id);
      if (inactiveShifts.length) {
        return err("Validation failed", 422, {
          shifts: [`Inactive shift IDs: ${inactiveShifts.join(", ")}`],
        });
      }

      const foundBranchIds = new Set(branches.map((b) => b.id));
      const missingBranches = branchIds.filter((b) => !foundBranchIds.has(b));
      if (missingBranches.length) {
        return err("Validation failed", 422, {
          shifts: [`Unknown branch IDs: ${missingBranches.join(", ")}`],
        });
      }

      const inactiveBranches = branches.filter((b) => !b.isActive).map((b) => b.id);
      if (inactiveBranches.length) {
        return err("Validation failed", 422, {
          shifts: [`Inactive branch IDs: ${inactiveBranches.join(", ")}`],
        });
      }
    }

    // Clear, re-insert and read back in one transaction, so a concurrent GET can
    // never observe the worker mid-swap with an empty roster.
    const shifts = await prisma.$transaction(async (tx) => {
      await tx.workerShift.deleteMany({ where: { workerId: id } });

      if (assignments.length) {
        await tx.workerShift.createMany({
          data: assignments.map((a) => ({
            workerId: id,
            shiftId: a.shiftId,
            branchId: a.branchId,
            startDate: a.startDate,
            endDate: a.endDate,
            isActive: a.isActive,
          })),
        });
      }

      return tx.workerShift.findMany({
        where: { workerId: id },
        orderBy: WORKER_SHIFT_ORDER,
        select: WORKER_SHIFT_SELECT,
      });
    });

    return ok(shifts, "Shifts updated");
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      switch (e.code) {
        // Only reachable if a shift or branch is deleted between validation and the
        // write — the pre-flight above turns every other bad id into a 422.
        case "P2003":
          return err("Validation failed", 422, {
            shifts: ["One or more shift or branch IDs no longer exist"],
          });
        case "P2025":
          return err("Worker not found", 404);
      }
    }
    return err("Internal server error", 500);
  }
}
