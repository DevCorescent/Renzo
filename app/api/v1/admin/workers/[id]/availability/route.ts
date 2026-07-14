// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Management — Availability
// ROUTE  : /api/v1/admin/workers/[id]/availability
//
// METHODS
// GET    - List worker availability blocks
// POST   - Create a worker availability block
//
// ACCESS
// GET    - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// POST   - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// ============================================================================

import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "@/types/api";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const MAX_REASON_LENGTH = 200;

// A block with no times covers the whole day. Modelling that as the full
// [00:00, 24:00) minute range lets one overlap predicate answer every case —
// full vs full, full vs partial, partial vs partial — instead of three.
const DAY_START_MINUTES = 0;
const DAY_END_MINUTES = 24 * 60;

/**
 * The shape both methods return, so a POST response is byte-identical to a
 * subsequent GET — the frontend never needs a second DTO for the same row.
 *
 * branchId is surfaced as a scalar rather than an expanded branch object because
 * WorkerAvailability carries no relation to Branch; the column is a plain
 * nullable string. Expanding it would cost a second query per row.
 */
const AVAILABILITY_SELECT = {
  id: true,
  date: true,
  fromTime: true,
  toTime: true,
  reason: true,
  branchId: true,
  createdAt: true,
} satisfies Prisma.WorkerAvailabilitySelect;

/**
 * Most recent block first — an admin opening this list is almost always looking
 * at what was just added, not at last year's leave. The id tiebreaker keeps
 * pagination deterministic when several blocks share a date, which is the norm:
 * a worker can hold a morning and an afternoon block on the same day.
 */
const AVAILABILITY_ORDER: Prisma.WorkerAvailabilityOrderByWithRelationInput[] = [
  { date: "desc" },
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
   GET /api/v1/admin/workers/[id]/availability — Unavailability blocks

   These blocks are subtractive: each one marks a window in which the worker
   CANNOT be booked. The slot generator and the appointment-assign routes both
   read them, so this list is the administrative view of what those surfaces will
   already be honouring.
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

    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    // A malformed range is refused rather than silently ignored: quietly dropping
    // the filter would return the worker's ENTIRE history to a caller who asked
    // for one week, and the mistake would be invisible.
    if (from && !DATE_RE.test(from)) {
      return err("Validation failed", 422, {
        from: ["Invalid date format. Use YYYY-MM-DD"],
      });
    }
    if (to && !DATE_RE.test(to)) {
      return err("Validation failed", 422, {
        to: ["Invalid date format. Use YYYY-MM-DD"],
      });
    }

    const where: Prisma.WorkerAvailabilityWhereInput = {
      workerId: id,
      // The column is @db.Date, so both bounds are pinned to UTC midnight to keep
      // the comparison on the same clock the rows were written with.
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
              ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
      ...(search ? { reason: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.workerAvailability.findMany({
        where,
        skip,
        take: limit,
        orderBy: AVAILABILITY_ORDER,
        select: AVAILABILITY_SELECT,
      }),
      prisma.workerAvailability.count({ where }),
    ]);

    return paginated(items, total, page, limit, "Worker availability fetched successfully");
  } catch {
    return err("Internal server error", 500);
  }
}

/* ============================================================================
   POST /api/v1/admin/workers/[id]/availability — Create one unavailability block

   Creates a single block. There is deliberately no update or delete here: a block
   that has already suppressed bookable slots is a historical fact, and those get
   dedicated routes rather than being silently rewritten through this one.

   Omitting fromTime and toTime means the worker is out for the whole day. Both
   times must be supplied together — a half-specified window has no defensible
   interpretation, and guessing at one would produce slots the salon cannot honour.
============================================================================ */

/** "HH:mm" → minutes past midnight. The format is validated before this runs. */
function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

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

    // ------------------------------------------------------------------------
    // Date
    // ------------------------------------------------------------------------

    const rawDate = typeof body.date === "string" ? body.date.trim() : "";
    let date: Date | null = null;

    if (!rawDate) {
      errors.date = ["Date is required"];
    } else if (!DATE_RE.test(rawDate)) {
      errors.date = ["Invalid date format. Use YYYY-MM-DD"];
    } else {
      // Constructed at UTC midnight explicitly: the column is @db.Date, and the
      // Date constructor's string parsing would otherwise shift the day for any
      // server not running in UTC.
      const parsed = new Date(`${rawDate}T00:00:00.000Z`);
      if (Number.isNaN(parsed.getTime())) {
        errors.date = ["Invalid date"];
      } else {
        date = parsed;
      }
    }

    // ------------------------------------------------------------------------
    // Window — both times, or neither
    // ------------------------------------------------------------------------

    const rawFrom = typeof body.fromTime === "string" ? body.fromTime.trim() : "";
    const rawTo = typeof body.toTime === "string" ? body.toTime.trim() : "";

    const hasFrom = rawFrom.length > 0;
    const hasTo = rawTo.length > 0;

    let fromTime: string | null = null;
    let toTime: string | null = null;

    if (hasFrom !== hasTo) {
      const missing = hasFrom ? "toTime" : "fromTime";
      errors[missing] = ["Both fromTime and toTime are required, or neither for a full-day block"];
    } else if (hasFrom && hasTo) {
      if (!TIME_RE.test(rawFrom)) {
        errors.fromTime = ["Invalid time format. Use HH:mm"];
      }
      if (!TIME_RE.test(rawTo)) {
        errors.toTime = ["Invalid time format. Use HH:mm"];
      }
      if (!errors.fromTime && !errors.toTime) {
        if (timeToMinutes(rawTo) <= timeToMinutes(rawFrom)) {
          errors.toTime = ["End time must be after start time"];
        } else {
          fromTime = rawFrom;
          toTime = rawTo;
        }
      }
    }

    // ------------------------------------------------------------------------
    // Reason
    //
    // Required despite being nullable in the schema: an unexplained block is one
    // nobody can safely remove later, so the column stays nullable for legacy
    // rows while every new block must justify itself.
    // ------------------------------------------------------------------------

    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason) {
      errors.reason = ["Reason is required"];
    } else if (reason.length > MAX_REASON_LENGTH) {
      errors.reason = [`Reason must be ${MAX_REASON_LENGTH} characters or fewer`];
    }

    // ------------------------------------------------------------------------
    // Branch — optional. Omitted means the block applies wherever the worker is.
    // ------------------------------------------------------------------------

    const rawBranchId = typeof body.branchId === "string" ? body.branchId.trim() : "";
    let branchId: string | null = null;

    if (rawBranchId) {
      // A branch admin scoping a block to some other branch is refused outright:
      // the body is not a trusted source for the branch boundary.
      if (user.userType === "BRANCH_ADMIN" && rawBranchId !== user.branchId) {
        return err("Forbidden — cannot create availability for another branch", 403);
      }
      branchId = rawBranchId;
    }

    if (Object.keys(errors).length) {
      return err("Validation failed", 422, errors);
    }

    // WorkerAvailability.branchId carries no foreign key, so a bad id would be
    // accepted silently and surface much later as a block nobody can attribute.
    // It has to be resolved here or not at all.
    if (branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true, isActive: true },
      });

      if (!branch) {
        return err("Validation failed", 422, { branchId: ["Branch not found"] });
      }
      if (!branch.isActive) {
        return err("Validation failed", 422, { branchId: ["Branch is inactive"] });
      }
    }

    // ------------------------------------------------------------------------
    // Overlap
    //
    // Contradictory windows on one date would later produce impossible booking
    // slots — a worker cannot be both free and blocked at 11:00 — so the whole
    // day is loaded and compared in memory rather than trusting the caller to
    // send a coherent set. Branch is deliberately NOT part of this predicate: a
    // worker is one person, so being blocked at 11:00 for branch A necessarily
    // blocks them at 11:00 everywhere.
    //
    // A full-day block is normalised to [00:00, 24:00), which makes the single
    // half-open overlap test below cover every combination, including the
    // full-day-vs-full-day duplicate.
    // ------------------------------------------------------------------------

    const existing = await prisma.workerAvailability.findMany({
      where: { workerId: id, date: date! },
      select: { fromTime: true, toTime: true },
    });

    const newStart = fromTime ? timeToMinutes(fromTime) : DAY_START_MINUTES;
    const newEnd = toTime ? timeToMinutes(toTime) : DAY_END_MINUTES;

    const conflict = existing.some((block) => {
      const start = block.fromTime ? timeToMinutes(block.fromTime) : DAY_START_MINUTES;
      const end = block.toTime ? timeToMinutes(block.toTime) : DAY_END_MINUTES;
      return newStart < end && start < newEnd;
    });

    if (conflict) {
      return err(
        "An availability block already exists for this worker on that date and overlaps the requested window",
        409
      );
    }

    const block = await prisma.workerAvailability.create({
      data: {
        workerId: id,
        branchId,
        date: date!,
        fromTime,
        toTime,
        reason,
      },
      select: AVAILABILITY_SELECT,
    });

    return created(block, "Availability block created");
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      switch (e.code) {
        // The only foreign key on this table is workerId, so a P2003 here means
        // the worker was deleted between authorisation and the write.
        case "P2003":
          return err("Worker not found", 404);
        case "P2025":
          return err("Worker not found", 404);
      }
    }
    return err("Internal server error", 500);
  }
}
