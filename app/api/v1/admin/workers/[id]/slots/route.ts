// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Management — Slots
// ROUTE  : /api/v1/admin/workers/[id]/slots
//
// METHODS
// GET    - Bookable slot grid for one worker, one day
//
// ACCESS
// GET    - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "@/types/api";

// The SAME engine the schedule route consumes. Availability is derived once, in
// one place, under one set of rules. A booking surface that re-derived it here
// would eventually disagree with the schedule about whether a worker is free at
// 14:00 — and the surface that was wrong would be the one selling the slot.
import {
  NON_OCCUPYING_STATUSES,
  WORKER_SELECT,
  WORKER_SHIFT_SELECT,
  APPOINTMENT_SELECT,
  AVAILABILITY_SELECT,
  LEAVE_SELECT,
  BRANCH_SELECT,
  BRANCH_TIMING_SELECT,
  resolveShift,
  toOpenIntervals,
  generateSlots,
  summariseSlots,
  type Slot,
  type SlotSummary,
} from "@/lib/scheduling";

// ============================================================================
// CONSTANTS
// ============================================================================

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// A slot shorter than five minutes is not a salon appointment, and one longer
// than eight hours cannot fit inside any realistic shift. Bounding the input also
// stops a caller asking for a one-minute grid and forcing the engine to
// materialise 1,440 objects per worker.
const MIN_SLOT_DURATION = 5;
const MAX_SLOT_DURATION = 480;

/**
 * Why no slots could be generated.
 *
 * Returned instead of an empty array with no explanation, because "fully booked",
 * "their day off" and "we never rostered this person" are three very different
 * answers, and a booking screen cannot tell them apart from `slots: []` alone.
 */
type NotBookableReason =
  | "WORKER_INACTIVE"
  | "WORKER_HAS_NO_BRANCH"
  | "BRANCH_INACTIVE"
  | "NO_SHIFT_ASSIGNED"
  | "SHIFT_INACTIVE"
  | "NOT_ROSTERED"
  | "INVALID_SHIFT_WINDOW"
  | "BRANCH_TIMING_NOT_CONFIGURED"
  | "SLOT_LONGER_THAN_SHIFT";

// ============================================================================
// AUTHORIZATION
// ============================================================================

/**
 * Resolve whether the caller may touch this worker at all.
 *
 * Mirrors the guard established in Worker CRUD, Services, Skills, Portfolio,
 * Availability, Shifts and Schedule so the isolation rule stays in one shape
 * across the module: branch membership is read from the persisted WorkerBranch
 * rows, never from the path, body or query, all of which the caller controls.
 * Returns an err() response in place of the record when access is refused,
 * matching requireAuth's `{ value, error }` convention.
 */
async function authorizeWorkerAccess(
  user: AuthUser,
  id: string
): Promise<
  | { worker: { id: string }; error: null }
  | { worker: null; error: ReturnType<typeof err> }
> {
  // Deny by default: a branch-scoped account with no branch must never fall
  // through to an unscoped read.
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

// ============================================================================
// GET /api/v1/admin/workers/[id]/slots — Bookable slot grid
//
// The ONE source of truth for worker booking availability. Customer booking,
// reception, admin booking, dashboards and analytics all read this rather than
// each computing "is this worker free?" from raw rows — which is exactly how two
// surfaces end up selling the same 14:00 twice.
//
// It does NOT book, and it does not reserve. Appointment carries no exclusion
// constraint and the schema has no hold/reservation model, so a slot reported
// FREE here can be taken by a concurrent request a millisecond later. The booking
// route must re-check on write. This endpoint is a read of the world as it
// stands, not a lock on it.
//
// TIMEZONE — identical to the schedule route, and identically constrained: Branch
// carries no timezone column, appointmentDate is @db.Date and every time is an
// "HH:mm" string, so "today" resolves in UTC. For an IST salon the day rolls over
// at 05:30 local. The resolved date is echoed back so no caller has to infer it.
// TODO: revisit once Branch carries a timezone.
// ============================================================================

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const url = new URL(req.url);

    const { error: accessError } = await authorizeWorkerAccess(user, id);
    if (accessError) return accessError;

    // ------------------------------------------------------------------------
    // Validate input
    //
    // Both a malformed date and a malformed duration are refused. Quietly
    // defaulting either returns a confidently wrong grid with a 200 — and the
    // booking screen would render it as though it were the truth.
    // ------------------------------------------------------------------------

    const errors: Record<string, string[]> = {};

    const rawDate = url.searchParams.get("date")?.trim();
    if (rawDate && !DATE_RE.test(rawDate)) {
      errors.date = ["Invalid date format. Use YYYY-MM-DD"];
    }

    const rawDuration = url.searchParams.get("duration")?.trim();
    let requestedDuration: number | null = null;

    if (rawDuration) {
      const parsed = Number(rawDuration);
      if (
        !Number.isInteger(parsed) ||
        parsed < MIN_SLOT_DURATION ||
        parsed > MAX_SLOT_DURATION
      ) {
        errors.duration = [
          `Duration must be a whole number of minutes between ${MIN_SLOT_DURATION} and ${MAX_SLOT_DURATION}`,
        ];
      } else {
        requestedDuration = parsed;
      }
    }

    if (Object.keys(errors).length) {
      return err("Validation failed", 422, errors);
    }

    const todayKey = new Date().toISOString().slice(0, 10);
    const dateKey = rawDate || todayKey;
    const date = new Date(`${dateKey}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      return err("Validation failed", 422, { date: ["Invalid date"] });
    }

    const dayOfWeek = date.getUTCDay();

    // ------------------------------------------------------------------------
    // Round 1 — six independent reads, all index-backed.
    //
    // Attendance is deliberately NOT read: it records what happened, not what can
    // be booked, and this route derives no currentStatus. The schedule route needs
    // it; a slot grid does not.
    // ------------------------------------------------------------------------

    const [worker, shiftRows, appointments, availabilityBlocks, leave, membership] =
      await Promise.all([
        prisma.workerProfile.findUnique({
          where: { id },
          select: WORKER_SELECT,
        }),

        prisma.workerShift.findMany({
          where: {
            workerId: id,
            isActive: true,
            startDate: { lte: date },
            OR: [{ endDate: null }, { endDate: { gte: date } }],
          },
          // Most recently effective assignment wins — see resolveShift().
          orderBy: [{ startDate: "desc" }, { id: "asc" }],
          select: WORKER_SHIFT_SELECT,
        }),

        prisma.appointment.findMany({
          where: {
            workerId: id,
            appointmentDate: date,
            status: { notIn: NON_OCCUPYING_STATUSES },
          },
          orderBy: [{ startTime: "asc" }, { id: "asc" }],
          select: APPOINTMENT_SELECT,
        }),

        prisma.workerAvailability.findMany({
          where: { workerId: id, date },
          orderBy: [{ fromTime: "asc" }, { id: "asc" }],
          select: AVAILABILITY_SELECT,
        }),

        // Leave carries no branchId and no link to WorkerAvailability, so an
        // approved leave does not block the diary on its own. It has to be layered
        // in explicitly or the worker would appear bookable while away.
        prisma.leave.findFirst({
          where: {
            workerId: id,
            status: "APPROVED",
            startDate: { lte: date },
            endDate: { gte: date },
          },
          select: LEAVE_SELECT,
        }),

        prisma.workerBranch.findFirst({
          where: { workerId: id, isActive: true },
          orderBy: { isPrimary: "desc" },
          select: { branchId: true },
        }),
      ]);

    if (!worker) return err("Worker not found", 404);

    // ------------------------------------------------------------------------
    // Round 2 — branch context.
    //
    // Unavoidable second round trip: BranchTiming and BranchHoliday are keyed by
    // branchId, which only exists once the shift (or the worker's membership) has
    // been read. The shift's branch wins over the primary membership — it is where
    // the worker is actually rostered that day.
    // ------------------------------------------------------------------------

    const branchId = shiftRows[0]?.branchId ?? membership?.branchId ?? null;

    const [branch, branchTiming, holiday] = await Promise.all([
      branchId
        ? prisma.branch.findUnique({ where: { id: branchId }, select: BRANCH_SELECT })
        : Promise.resolve(null),

      branchId
        ? prisma.branchTiming.findUnique({
            where: { branchId_dayOfWeek: { branchId, dayOfWeek } },
            select: BRANCH_TIMING_SELECT,
          })
        : Promise.resolve(null),

      branchId
        ? prisma.branchHoliday.findFirst({
            where: { branchId, date },
            select: { id: true, reason: true },
          })
        : Promise.resolve(null),
    ]);

    // ------------------------------------------------------------------------
    // Resolve the grid
    //
    // Every path that yields no slots returns a REASON alongside the empty array.
    // Without one, a booking screen cannot distinguish a fully-booked stylist from
    // one who was never rostered, and would render both as "no availability".
    // ------------------------------------------------------------------------

    const shift = resolveShift(shiftRows, dayOfWeek);

    // Slot granularity: the caller's value, else the branch's configured
    // slotDuration. If neither exists we do NOT fall back to a guessed 30 — a grid
    // built on an invented granularity is one nobody configured, and every slot
    // boundary in it would be fiction.
    const slotDuration = requestedDuration ?? branchTiming?.slotDuration ?? null;

    const empty = (reason: NotBookableReason) =>
      ok(
        {
          worker,
          branch,
          date: dateKey,
          slotDuration,
          notBookableReason: reason,
          summary: summariseSlots([]),
          slots: [] as Slot[],
        },
        "Worker slots fetched successfully"
      );

    if (!worker.isActive) return empty("WORKER_INACTIVE");
    if (!branchId || !branch) return empty("WORKER_HAS_NO_BRANCH");
    if (!branch.isActive) return empty("BRANCH_INACTIVE");
    if (!shift) return empty("NO_SHIFT_ASSIGNED");

    // Holds a roster, but the Shift template itself has been retired.
    if (!shift.row.shift.isActive) return empty("SHIFT_INACTIVE");

    // Holds a roster, but this weekday is not in its workingDays — their weekly off.
    if (!shift.isRosteredToday) return empty("NOT_ROSTERED");

    // Nothing in the schema forbids Shift.endTime <= Shift.startTime. resolveShift()
    // refuses to invent a window out of corrupt data rather than emitting slots of
    // negative length.
    if (!shift.window) return empty("INVALID_SHIFT_WINDOW");

    if (slotDuration === null) return empty("BRANCH_TIMING_NOT_CONFIGURED");

    // A granularity wider than the shift cannot yield one whole slot. Not an error:
    // a 90-minute grid simply does not fit a 60-minute shift.
    if (slotDuration > shift.window.end - shift.window.start) {
      return empty("SLOT_LONGER_THAN_SHIFT");
    }

    // ------------------------------------------------------------------------
    // Engine — pure computation from here down. No further queries.
    //
    // openIntervals is what makes a slot that sits inside the roster but outside
    // the branch's opening hours — a holiday, a closed weekday, or a shift running
    // past closing time — come back OFF_DUTY rather than FREE. A worker being on
    // the rota is not the same thing as the doors being open.
    // ------------------------------------------------------------------------

    const slots: Slot[] = generateSlots({
      shiftWindow: shift.window,
      breakWindow: shift.breakWindow,
      duration: slotDuration,
      appointments,
      availabilityBlocks,
      leave,
      openIntervals: toOpenIntervals(branchTiming, holiday !== null),
    });

    const summary: SlotSummary = summariseSlots(slots);

    return ok(
      {
        worker,
        branch,
        date: dateKey,
        slotDuration,
        notBookableReason: null,
        summary,
        slots,
      },
      "Worker slots fetched successfully"
    );
  } catch (e: unknown) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      switch (e.code) {
        case "P2025":
          return err("Worker not found", 404);
        case "P2003":
          return err("Worker not found", 404);
      }
    }
    return err("Internal server error", 500);
  }
}
