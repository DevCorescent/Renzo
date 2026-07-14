// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Management — Schedule
// ROUTE  : /api/v1/admin/workers/[id]/schedule
//
// METHODS
// GET    - Worker daily schedule
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

// The scheduling engine lives in lib/scheduling so that this route and the slot
// route derive availability from ONE implementation. Two surfaces that computed
// it independently would eventually disagree about whether a worker is free at
// 14:00 — and the one that was wrong would be the one selling the slot.
import {
  NON_OCCUPYING_STATUSES,
  WORKER_SELECT,
  WORKER_SHIFT_SELECT,
  APPOINTMENT_SELECT,
  AVAILABILITY_SELECT,
  LEAVE_SELECT,
  ATTENDANCE_SELECT,
  BRANCH_SELECT,
  BRANCH_TIMING_SELECT,
  type Interval,
  mergeIntervals,
  resolveShift,
  toAppointmentInterval,
  toBlockedIntervals,
  toLeaveIntervals,
  generateTimeline,
  calculateMetrics,
  resolveCurrentStatus,
  collectWarnings,
} from "@/lib/scheduling";

// ============================================================================
// CONSTANTS
// ============================================================================

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ============================================================================
// AUTHORIZATION
// ============================================================================

/**
 * Resolve whether the caller may touch this worker at all.
 *
 * Mirrors the guard established in Worker CRUD, Services, Skills, Portfolio,
 * Availability and Shifts so the isolation rule stays in one shape across the
 * module: branch membership is read from the persisted WorkerBranch rows, never
 * from the path, body or query, all of which the caller controls. Returns an
 * err() response in place of the record when access is refused, matching
 * requireAuth's `{ value, error }` convention.
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
// GET /api/v1/admin/workers/[id]/schedule — Worker daily schedule
//
// The single source of truth for one worker, one day. Every downstream consumer
// (dashboards, assignment, reception, attendance, payroll, analytics) reads the
// same computed timeline rather than each re-deriving it from raw rows and
// drifting apart.
//
// TIMEZONE — a documented limitation, not an oversight. Branch carries no
// timezone column, Appointment.appointmentDate is @db.Date and every time is an
// "HH:mm" string, so "today" can only be resolved in UTC. For an IST salon the
// schedule day therefore rolls over at 05:30 local. The resolved date is echoed
// back in the response so no caller has to infer it.
// TODO: revisit once Branch carries a timezone; this endpoint is the right place
// to apply it, but inventing the column here is out of scope.
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
    // Resolve date
    //
    // A malformed date is refused rather than quietly defaulted: silently
    // returning TODAY's schedule to a caller who asked for last Tuesday is a
    // wrong answer delivered with a 200.
    // ------------------------------------------------------------------------

    const rawDate = url.searchParams.get("date")?.trim();
    const todayKey = new Date().toISOString().slice(0, 10);

    if (rawDate && !DATE_RE.test(rawDate)) {
      return err("Validation failed", 422, {
        date: ["Invalid date format. Use YYYY-MM-DD"],
      });
    }

    const dateKey = rawDate || todayKey;
    const date = new Date(`${dateKey}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      return err("Validation failed", 422, { date: ["Invalid date"] });
    }

    const dayOfWeek = date.getUTCDay();
    const isToday = dateKey === todayKey;

    // Only a request for today has a meaningful "now".
    const now = new Date();
    const nowMinutes = isToday ? now.getUTCHours() * 60 + now.getUTCMinutes() : null;

    // ------------------------------------------------------------------------
    // Round 1 — seven independent reads, all index-backed.
    //
    // Appointment[workerId, appointmentDate], WorkerAvailability[workerId, date],
    // WorkerShift[workerId, isActive], Attendance[workerId, date] (unique) and
    // Leave[workerId, status] each have a covering index. Appointments pull their
    // services and customer in the same query, so there is no N+1 here.
    // ------------------------------------------------------------------------

    const [
      worker,
      shiftRows,
      appointments,
      availabilityBlocks,
      leave,
      attendance,
      membership,
    ] = await Promise.all([
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
      // in here explicitly or the worker would appear bookable while away.
      prisma.leave.findFirst({
        where: {
          workerId: id,
          status: "APPROVED",
          startDate: { lte: date },
          endDate: { gte: date },
        },
        select: LEAVE_SELECT,
      }),

      prisma.attendance.findUnique({
        where: { workerId_date: { workerId: id, date } },
        select: ATTENDANCE_SELECT,
      }),

      prisma.workerBranch.findFirst({
        where: { workerId: id, isActive: true },
        orderBy: { isPrimary: "desc" },
        select: { branchId: true },
      }),
    ]);

    // ------------------------------------------------------------------------
    // Round 2 — branch context.
    //
    // A second round trip is unavoidable: BranchTiming and BranchHoliday are keyed
    // by branchId, which is only known once the shift (or the worker's membership)
    // has been read. The shift's branch wins over the primary membership — it is
    // where the worker is actually rostered that day.
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
    // Engine — pure computation from here down. No further queries.
    // ------------------------------------------------------------------------

    const shift = resolveShift(shiftRows, dayOfWeek);

    const bookedIntervals = mergeIntervals(
      appointments.map(toAppointmentInterval).filter((i): i is Interval => i !== null)
    );

    const blockedIntervals = mergeIntervals(toBlockedIntervals(availabilityBlocks));
    const leaveIntervals = toLeaveIntervals(leave);

    const timeline = generateTimeline(
      shift?.window ?? null,
      shift?.breakWindow ?? null,
      bookedIntervals,
      blockedIntervals,
      leaveIntervals
    );

    const metrics = calculateMetrics(
      shift?.window ?? null,
      shift?.breakWindow ?? null,
      bookedIntervals,
      blockedIntervals,
      leaveIntervals,
      appointments,
      nowMinutes
    );

    const status = resolveCurrentStatus(
      nowMinutes,
      shift,
      leave,
      attendance,
      appointments,
      blockedIntervals
    );

    const warnings = collectWarnings(
      appointments,
      shift,
      shiftRows.length,
      leave,
      holiday !== null,
      blockedIntervals
    );

    // ------------------------------------------------------------------------
    // Response — grouped, not a flat bag of forty keys.
    //
    // NOTE ON ATTENDANCE: only checkIn / checkOut / breaks / status are surfaced.
    // Attendance.workingMinutes, lateMinutes and overtimeMinutes exist as columns
    // but NO code in this repository ever writes them — they sit at their default
    // of 0. Returning them would hand Payroll a confident zero for a worker who
    // did a full day.
    // TODO: surface those three once an attendance engine actually computes them
    // (it would compare Attendance.checkIn against the resolved Shift window,
    // which this route already has in hand).
    // ------------------------------------------------------------------------

    return ok(
      {
        worker,

        branch,

        schedule: {
          date: dateKey,
          dayOfWeek,
          isToday,
          isHoliday: holiday !== null,
          holidayReason: holiday?.reason ?? null,

          branchTiming,

          shift: shift
            ? {
                workerShiftId: shift.row.id,
                shiftId: shift.row.shift.id,
                name: shift.row.shift.name,
                startTime: shift.row.shift.startTime,
                endTime: shift.row.shift.endTime,
                breakStart: shift.row.shift.breakStart,
                breakEnd: shift.row.shift.breakEnd,
                workingDays: shift.row.shift.workingDays,
                isRosteredToday: shift.isRosteredToday,
              }
            : null,

          leave: leave
            ? {
                id: leave.id,
                startDate: leave.startDate,
                endDate: leave.endDate,
                reason: leave.reason,
                type: leave.leaveType,
              }
            : null,

          attendance,

          availabilityBlocks,

          appointments,
        },

        timeline,

        metrics,

        status,

        warnings,
      },
      "Worker schedule fetched successfully"
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
