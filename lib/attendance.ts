// ============================================================================
// MODULE : Attendance Engine
//
// THE attendance engine. One implementation, many consumers — the same reason
// lib/scheduling.ts exists. Working hours, late minutes and overtime are derived
// HERE and nowhere else, so the worker's own page, the admin table, the reports
// and the exports can never disagree about how long someone worked.
//
// CONSUMERS
//   POST/PATCH /api/v1/admin/attendance{,/[id],/bulk}
//   POST       /api/v1/branch-admin/attendance
//   POST       /api/v1/reception/attendance
//   GET/POST   /api/v1/worker/attendance
//   GET        /api/v1/admin/attendance/{summary,report,calendar,export}
//
// Everything below is PURE — no Prisma client, no request context. Callers load
// the rows and hand them in. lib/attendance-service.ts is the Prisma-facing half.
//
// ── TIME MODEL ──────────────────────────────────────────────────────────────
// Shift.startTime / endTime are `String` ("09:00"), not Postgres time types, and
// Attendance.checkIn is an absolute `DateTime`. Comparing the two requires a
// timezone: "09:00" means nine in the morning where the salon is, not UTC.
//
// So a shift is ANCHORED onto the attendance date in salon-local time, producing
// real Date instants, and every metric is then a plain instant subtraction. That
// is what makes an overnight shift (22:00 → 06:00) work: the anchored end simply
// lands on the next calendar day, and no minutes-past-midnight arithmetic can
// wrap around and produce a 1,400-minute "early leave".
// ============================================================================

import type { AttendanceStatus as PrismaAttendanceStatus } from "@prisma/client";
import type { UserType } from "@/types/api";

// ============================================================================
// CAPABILITIES
//
// What each role may DO to an attendance record. Lives in the pure engine, not in
// the route layer, because two very different callers need the same answer:
//   • lib/attendance-api.ts       — to ENFORCE it on every request
//   • the admin pages (server)    — to decide which buttons to render
// One table means the buttons a role sees can never drift from what the API will
// actually permit.
// ============================================================================

export type AttendanceCapability = {
  canMark: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canBulk: boolean;
  canApproveOvertime: boolean;
  canLock: boolean;
  /** May act on a record another role has locked for payroll. */
  canOverrideLock: boolean;
  /** May write attendance for a date other than today. */
  canBackdate: boolean;
};

const NO_ACCESS: AttendanceCapability = {
  canMark: false, canEdit: false, canDelete: false, canBulk: false,
  canApproveOvertime: false, canLock: false, canOverrideLock: false, canBackdate: false,
};

/**
 * Exhaustive by construction — `Record<UserType, …>` fails the build if a role is
 * added to UserType and left unclassified, so a new role can never silently
 * inherit delete rights.
 */
const ROLE_CAPABILITIES: Record<UserType, AttendanceCapability> = {
  SUPER_ADMIN: {
    canMark: true, canEdit: true, canDelete: true, canBulk: true,
    canApproveOvertime: true, canLock: true, canOverrideLock: true, canBackdate: true,
  },
  OWNER: {
    canMark: true, canEdit: true, canDelete: true, canBulk: true,
    canApproveOvertime: true, canLock: true, canOverrideLock: true, canBackdate: true,
  },
  BRANCH_ADMIN: {
    canMark: true, canEdit: true, canDelete: true, canBulk: true,
    // Overtime costs money and a locked row belongs to payroll, so both stay platform-level.
    canApproveOvertime: false, canLock: false, canOverrideLock: false, canBackdate: true,
  },
  RECEPTIONIST: {
    // The front desk clocks people in and out. It does not rewrite history,
    // delete records, or touch anything payroll depends on.
    canMark: true, canEdit: false, canDelete: false, canBulk: false,
    canApproveOvertime: false, canLock: false, canOverrideLock: false, canBackdate: false,
  },
  // A worker's authority is different in KIND, not degree: they may always clock
  // THEMSELVES and never anybody else, which no admin capability expresses.
  WORKER: NO_ACCESS,
  CUSTOMER: NO_ACCESS,
  INVENTORY_MANAGER: NO_ACCESS,
  MARKETING_MANAGER: NO_ACCESS,
  // Reads payroll inputs elsewhere; never authors them.
  ACCOUNTANT: NO_ACCESS,
};

export function capabilitiesFor(userType: UserType): AttendanceCapability {
  return ROLE_CAPABILITIES[userType];
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Where the salon is. Every "HH:mm" in the Shift table is read in this zone.
 *
 * The whole codebase already renders in it (`toLocaleTimeString("en-IN", {
 * timeZone: "Asia/Kolkata" })` in the worker attendance page, `en-IN` dates and
 * ₹ throughout), so this states an assumption that was already load-bearing
 * rather than introducing a new one.
 */
export const SALON_TIME_ZONE = "Asia/Kolkata";

/** Fallback when a shift row leaves `graceMinutes` unset. Mirrors the column default. */
export const DEFAULT_GRACE_MINUTES = 10;

/**
 * Below this fraction of the scheduled day, a completed attendance is a HALF_DAY.
 * Only ever applied once the worker has actually checked OUT — a worker who is
 * still on the floor at 11am has not worked a half day, they are mid-shift.
 */
export const HALF_DAY_RATIO = 0.5;

/** Every value of the Prisma enum, in display order. */
export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "LATE",
  "HALF_DAY",
  "ABSENT",
  "ON_LEAVE",
  "HOLIDAY",
  "WEEK_OFF",
] as const satisfies readonly PrismaAttendanceStatus[];

/**
 * Deliberately an ALIAS of the Prisma enum rather than a parallel union, so the
 * engine and the column can never drift. Adding a value to `AttendanceStatus` in
 * schema.prisma fails the build here at `STATUS_CREDIT` — a `Record` over this
 * type — until the new value is given a credit weight and a display order above.
 */
export type AttendanceStatus = PrismaAttendanceStatus;

/**
 * Statuses that are NOT an attendance opportunity.
 *
 * A branch holiday, a rostered week-off and an approved leave are days the worker
 * was never expected to appear. Counting them in the denominator of an attendance
 * percentage would punish someone for a Sunday. Excluded from the denominator by
 * `summarizeAttendance()` and by the admin/worker dashboards alike.
 */
export const NON_WORKING_STATUSES = ["HOLIDAY", "WEEK_OFF", "ON_LEAVE"] as const;

/** Attendance credit per status. HALF_DAY is worth half a day, by definition. */
const STATUS_CREDIT: Record<AttendanceStatus, number> = {
  PRESENT: 1,
  LATE: 1,
  HALF_DAY: 0.5,
  ABSENT: 0,
  ON_LEAVE: 0,
  HOLIDAY: 0,
  WEEK_OFF: 0,
};

export function isNonWorkingStatus(status: AttendanceStatus): boolean {
  return (NON_WORKING_STATUSES as readonly string[]).includes(status);
}

// ============================================================================
// TIMEZONE PRIMITIVES
// ============================================================================

/**
 * The zone's UTC offset, in milliseconds, at a given instant.
 *
 * Formats the instant into the target zone, reads the wall-clock back as though
 * it were UTC, and takes the delta. Asia/Kolkata has no DST so this is a constant
 * +05:30 today — it is computed rather than hardcoded so that changing
 * SALON_TIME_ZONE to a DST zone stays correct instead of silently drifting by an
 * hour for half the year.
 */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");

  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );

  return asIfUtc - at.getTime();
}

/**
 * The salon-local calendar date of an instant, as the midnight-UTC `Date` that
 * the `@db.Date` column stores.
 *
 * COMPATIBILITY: for every hour a salon actually trades this returns exactly what
 * the original worker route's `new Date(new Date().toISOString().slice(0,10))`
 * returned, so existing rows and the `[workerId, date]` unique key are unaffected.
 * It differs only after 23:30 IST, where the old code filed the row under the
 * previous UTC day — which is the bug this fixes for late-closing branches.
 */
export function attendanceDateKey(at: Date = new Date()): Date {
  const local = new Date(at.getTime() + zoneOffsetMs(at, SALON_TIME_ZONE));
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  );
}

/** Parse a "YYYY-MM-DD" string into the midnight-UTC `Date` the column stores. */
export function parseDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Render a midnight-UTC date column back to "YYYY-MM-DD". */
export function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Anchor an "HH:mm" wall-clock time onto a date key, in salon-local time,
 * returning the absolute instant it refers to.
 *
 * `dayOffset` shifts the result by whole days — used to push an overnight shift's
 * end onto the following morning.
 */
export function anchorLocalTime(
  dateKey: Date,
  hhmm: string,
  dayOffset = 0
): Date | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  // Build the naive local timestamp, then subtract the zone's offset AT that
  // moment to land on the true instant.
  const naive = Date.UTC(
    dateKey.getUTCFullYear(),
    dateKey.getUTCMonth(),
    dateKey.getUTCDate() + dayOffset,
    hours,
    minutes
  );

  const provisional = new Date(naive);
  return new Date(naive - zoneOffsetMs(provisional, SALON_TIME_ZONE));
}

/** The salon-local weekday of a date key. 0 = Sunday, matching Shift.workingDays. */
export function localDayOfWeek(dateKey: Date): number {
  return dateKey.getUTCDay();
}

/** Wall-clock "HH:mm" of an instant, in salon-local time. For tables and exports. */
export function formatLocalTime(at: Date | null | undefined): string {
  if (!at) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SALON_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
}

// ============================================================================
// SHIFT WINDOW
// ============================================================================

/** The subset of a Shift row the engine needs. Structural, so any select fits. */
export type ShiftWindow = {
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  workingDays: number[];
  graceMinutes?: number | null;
  isActive?: boolean;
};

/** A shift anchored onto one concrete date. */
export type AnchoredShift = {
  start: Date;
  end: Date;
  breakStart: Date | null;
  breakEnd: Date | null;
  graceMinutes: number;
  /** Paid minutes the roster expects: window length minus the unpaid break. */
  scheduledMinutes: number;
  /** False when this weekday is outside Shift.workingDays — the worker's week-off. */
  isRostered: boolean;
};

const MINUTE_MS = 60_000;

function diffMinutes(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MINUTE_MS);
}

/**
 * Anchor a shift template onto a date.
 *
 * Returns null for a template the engine cannot interpret (unparseable times).
 * An `endTime` at or before `startTime` is NOT corrupt — it is an overnight
 * shift, and the end is placed on the following day.
 */
export function anchorShift(dateKey: Date, shift: ShiftWindow): AnchoredShift | null {
  const start = anchorLocalTime(dateKey, shift.startTime);
  if (!start) return null;

  let end = anchorLocalTime(dateKey, shift.endTime);
  if (!end) return null;

  // Overnight: 22:00 → 06:00 ends tomorrow morning.
  if (end.getTime() <= start.getTime()) {
    end = anchorLocalTime(dateKey, shift.endTime, 1);
    if (!end) return null;
  }

  let breakStart: Date | null = null;
  let breakEnd: Date | null = null;

  if (shift.breakStart && shift.breakEnd) {
    const bs = anchorLocalTime(dateKey, shift.breakStart);
    let be = anchorLocalTime(dateKey, shift.breakEnd);

    if (bs && be) {
      // A break that reads as ending before it starts belongs to the overnight
      // tail of the same shift (e.g. 23:30 → 00:15).
      if (be.getTime() <= bs.getTime()) be = anchorLocalTime(dateKey, shift.breakEnd, 1);

      // Only honour a break that genuinely falls inside the shift window.
      if (be && be.getTime() > bs.getTime() && bs >= start && be <= end) {
        breakStart = bs;
        breakEnd = be;
      }
    }
  }

  const windowMinutes = diffMinutes(start, end);
  const rosteredBreak = breakStart && breakEnd ? diffMinutes(breakStart, breakEnd) : 0;

  return {
    start,
    end,
    breakStart,
    breakEnd,
    graceMinutes: shift.graceMinutes ?? DEFAULT_GRACE_MINUTES,
    scheduledMinutes: Math.max(0, windowMinutes - rosteredBreak),
    isRostered: (shift.isActive ?? true) && shift.workingDays.includes(localDayOfWeek(dateKey)),
  };
}

// ============================================================================
// METRICS
// ============================================================================

export type AttendanceMetrics = {
  workingMinutes: number;
  breakMinutes: number;
  lateMinutes: number;
  earlyArrivalMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
};

export const ZERO_METRICS: AttendanceMetrics = {
  workingMinutes: 0,
  breakMinutes: 0,
  lateMinutes: 0,
  earlyArrivalMinutes: 0,
  earlyLeaveMinutes: 0,
  overtimeMinutes: 0,
};

export type MetricsInput = {
  checkIn: Date | null;
  checkOut: Date | null;
  breakStart: Date | null;
  breakEnd: Date | null;
  /** The anchored roster for this date, or null when the worker has no shift. */
  shift: AnchoredShift | null;
};

/**
 * Derive every stored metric from the four timestamps and the roster.
 *
 * WITHOUT A SHIFT the engine still reports working and break minutes — those come
 * from the worker's own timestamps and are true regardless of roster. It reports
 * ZERO late / early / overtime, because "late" is meaningless without a scheduled
 * start, and inventing a default start time would put a fabricated number in front
 * of Payroll. That is the deliberate difference from a system that guesses 09:00.
 *
 * BREAKS are subtracted from working time only once the break has been CLOSED. An
 * open break (started, not ended) is not yet a known duration; counting it would
 * mean a worker's hours ticked down while the record said nothing had happened.
 */
export function computeMetrics(input: MetricsInput): AttendanceMetrics {
  const { checkIn, checkOut, breakStart, breakEnd, shift } = input;

  const breakMinutes =
    breakStart && breakEnd && breakEnd.getTime() > breakStart.getTime()
      ? diffMinutes(breakStart, breakEnd)
      : 0;

  const grossMinutes =
    checkIn && checkOut && checkOut.getTime() > checkIn.getTime()
      ? diffMinutes(checkIn, checkOut)
      : 0;

  // A break longer than the session it sits inside is contradictory data; clamp
  // at zero rather than emitting negative hours into payroll.
  const workingMinutes = Math.max(0, grossMinutes - breakMinutes);

  if (!shift) {
    return { ...ZERO_METRICS, workingMinutes, breakMinutes };
  }

  let lateMinutes = 0;
  let earlyArrivalMinutes = 0;

  if (checkIn) {
    const delta = diffMinutes(shift.start, checkIn);
    if (delta > shift.graceMinutes) {
      // Grace forgives entirely up to its limit; past it the worker is late by the
      // full margin from the rostered start, not merely by the overshoot.
      lateMinutes = delta;
    } else if (delta < 0) {
      earlyArrivalMinutes = -delta;
    }
  }

  let earlyLeaveMinutes = 0;
  let overtimeMinutes = 0;

  if (checkOut) {
    const delta = diffMinutes(shift.end, checkOut);
    if (delta > 0) overtimeMinutes = delta;
    else if (delta < 0) earlyLeaveMinutes = -delta;
  }

  return {
    workingMinutes,
    breakMinutes,
    lateMinutes,
    earlyArrivalMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
  };
}

// ============================================================================
// STATUS
// ============================================================================

export type StatusContext = {
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  workingMinutes: number;
  lateMinutes: number;
  /** Branch closure on this date. */
  isHoliday: boolean;
  /** An APPROVED leave covers this date. */
  isOnLeave: boolean;
  /** The roster covers this weekday. Undefined when the worker has no shift at all. */
  isRostered: boolean | null;
  scheduledMinutes: number;
};

/**
 * Derive the status a record should carry.
 *
 * PRECEDENCE, highest first: branch holiday → approved leave → rostered week-off
 * → no check-in (absent) → short completed day (half day) → late → present.
 *
 * Holiday outranks leave so that a worker who booked leave on a day the branch
 * then closed is not billed a leave day for a day nobody worked.
 */
export function deriveStatus(ctx: StatusContext): AttendanceStatus {
  if (ctx.isHoliday) return "HOLIDAY";
  if (ctx.isOnLeave) return "ON_LEAVE";

  // Only a worker who did NOT turn up gets a week-off. Someone who came in on
  // their day off worked, and is recorded as having worked.
  if (ctx.isRostered === false && !ctx.hasCheckIn) return "WEEK_OFF";

  if (!ctx.hasCheckIn) return "ABSENT";

  if (
    ctx.hasCheckOut &&
    ctx.scheduledMinutes > 0 &&
    ctx.workingMinutes < ctx.scheduledMinutes * HALF_DAY_RATIO
  ) {
    return "HALF_DAY";
  }

  if (ctx.lateMinutes > 0) return "LATE";
  return "PRESENT";
}

// ============================================================================
// AGGREGATION
// ============================================================================

/** The stored shape every aggregate reads. Structural — any select that fits works. */
export type SummarizableRow = {
  status: AttendanceStatus;
  workingMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  breakMinutes: number;
  checkIn?: Date | null;
  checkOut?: Date | null;
};

export type AttendanceSummary = {
  /** Rows examined. */
  total: number;
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  onLeave: number;
  holiday: number;
  weekOff: number;
  /** Rows that were a real attendance opportunity (total − holiday/week-off/leave). */
  countableDays: number;
  /** PRESENT + LATE + ½·HALF_DAY. */
  creditedDays: number;
  /** creditedDays / countableDays, as a percentage. Null when nothing is countable. */
  attendancePct: number | null;
  workingMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  breakMinutes: number;
  workingHours: number;
  overtimeHours: number;
  /** Mean working minutes across countable days. */
  avgWorkingMinutes: number;
  /** Mean late minutes across days that were actually late. */
  avgLateMinutes: number;
  /** Currently clocked in and not yet out. */
  checkedIn: number;
  checkedOut: number;
};

/**
 * The single definition of every attendance total in the product.
 *
 * Used by the worker's own page, the admin dashboard cards, every report tab and
 * all three exports — so a CSV can never disagree with the screen it was
 * downloaded from.
 */
export function summarizeAttendance(rows: SummarizableRow[]): AttendanceSummary {
  const s: AttendanceSummary = {
    total: rows.length,
    present: 0,
    late: 0,
    halfDay: 0,
    absent: 0,
    onLeave: 0,
    holiday: 0,
    weekOff: 0,
    countableDays: 0,
    creditedDays: 0,
    attendancePct: null,
    workingMinutes: 0,
    overtimeMinutes: 0,
    lateMinutes: 0,
    breakMinutes: 0,
    workingHours: 0,
    overtimeHours: 0,
    avgWorkingMinutes: 0,
    avgLateMinutes: 0,
    checkedIn: 0,
    checkedOut: 0,
  };

  let lateDays = 0;

  for (const row of rows) {
    switch (row.status) {
      case "PRESENT": s.present += 1; break;
      case "LATE": s.late += 1; break;
      case "HALF_DAY": s.halfDay += 1; break;
      case "ABSENT": s.absent += 1; break;
      case "ON_LEAVE": s.onLeave += 1; break;
      case "HOLIDAY": s.holiday += 1; break;
      case "WEEK_OFF": s.weekOff += 1; break;
    }

    s.workingMinutes += row.workingMinutes;
    s.overtimeMinutes += row.overtimeMinutes;
    s.lateMinutes += row.lateMinutes;
    s.breakMinutes += row.breakMinutes;

    if (row.lateMinutes > 0) lateDays += 1;

    if (!isNonWorkingStatus(row.status)) {
      s.countableDays += 1;
      s.creditedDays += STATUS_CREDIT[row.status];
    }

    if (row.checkIn && !row.checkOut) s.checkedIn += 1;
    if (row.checkIn && row.checkOut) s.checkedOut += 1;
  }

  s.attendancePct =
    s.countableDays > 0 ? Math.round((s.creditedDays / s.countableDays) * 1000) / 10 : null;
  s.workingHours = Math.round((s.workingMinutes / 60) * 10) / 10;
  s.overtimeHours = Math.round((s.overtimeMinutes / 60) * 10) / 10;
  s.avgWorkingMinutes = s.countableDays > 0 ? Math.round(s.workingMinutes / s.countableDays) : 0;
  s.avgLateMinutes = lateDays > 0 ? Math.round(s.lateMinutes / lateDays) : 0;

  return s;
}

// ============================================================================
// FORMATTING
// ============================================================================

/** 495 → "8h 15m". The one duration format used across UI, CSV, Excel and PDF. */
export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0h 0m";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m}m`;
}

/** 495 → 8.25. For numeric columns in spreadsheets, where "8h 15m" cannot be summed. */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/** Human label for a status, e.g. "HALF_DAY" → "Half Day". */
export function statusLabel(status: AttendanceStatus): string {
  return status
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}
