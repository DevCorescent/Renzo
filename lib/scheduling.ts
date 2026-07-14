// ============================================================================
// OWNER  : Gauransh
// MODULE : Scheduling Engine
//
// THE scheduling engine. One implementation, many consumers.
//
// CONSUMERS
//   GET /api/v1/admin/workers/[id]/schedule   — timeline, metrics, status
//   GET /api/v1/admin/workers/[id]/slots      — bookable slot grid
//
// This module exists so that no two surfaces can ever disagree about whether a
// worker is free at 14:00. Availability is derived here, once, from the same
// rows under the same rules; a consumer that re-derived it independently would
// eventually drift and start selling slots that are already booked.
//
// Everything below is PURE — no Prisma client, no request context. Callers load
// the rows (each is index-backed) and hand them in. That is what lets a future
// Branch Calendar run this over 100 workers without re-querying per worker.
//
// TIME MODEL — a schema constraint, not a preference. Appointment.startTime,
// Shift.startTime and WorkerAvailability.fromTime are all `String` ("HH:mm"),
// not Postgres time types, so the database cannot compare or subtract them. All
// interval algebra therefore happens here, in minutes past midnight.
// ============================================================================

import { Prisma, AppointmentStatus } from "@prisma/client";

// ============================================================================
// CONSTANTS
// ============================================================================

// The whole-day window. A leave, or an availability block with null times,
// covers the day; normalising both to this range lets one interval algebra
// answer every question instead of special-casing "full day" everywhere.
export const DAY_START_MINUTES = 0;
export const DAY_END_MINUTES = 24 * 60;

/**
 * Statuses that do NOT consume the worker's time.
 *
 * CANCELLED and NO_SHOW never happened. RESCHEDULED has moved to another slot —
 * counting it here would bill the worker's day twice. Every other status
 * (PENDING, CONFIRMED, CHECKED_IN, STARTED, COMPLETED) occupies the diary and is
 * therefore real occupancy. Mirrors the convention already used by public/slots
 * and reception/appointments/[id]/assign.
 */
export const NON_OCCUPYING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
  AppointmentStatus.RESCHEDULED,
];

/**
 * Timeline segment kinds, in descending precedence.
 *
 * BOOKED outranks everything because an appointment is a commitment made to a
 * customer: if it collides with a break or a leave day, the truthful thing to
 * render is the booking, and to raise a warning about the contradiction — not to
 * quietly hide the appointment behind the break.
 */
export const SEGMENT_BOOKED = "BOOKED";
export const SEGMENT_LEAVE = "LEAVE";
export const SEGMENT_BLOCKED = "BLOCKED";
export const SEGMENT_BREAK = "BREAK";
export const SEGMENT_FREE = "FREE";
export const SEGMENT_OFF_DUTY = "OFF_DUTY";

export type SegmentType =
  | typeof SEGMENT_BOOKED
  | typeof SEGMENT_LEAVE
  | typeof SEGMENT_BLOCKED
  | typeof SEGMENT_BREAK
  | typeof SEGMENT_FREE
  | typeof SEGMENT_OFF_DUTY;

/**
 * Computed worker status. Deliberately NOT a Prisma enum — the schema has no
 * WorkerStatus type and inventing one would be a migration this engine has no
 * business forcing. It is derived per-request from shift, leave, attendance and
 * appointment state.
 */
export type WorkerStatus =
  | "AVAILABLE"
  | "ON_SERVICE"
  | "ON_BREAK"
  | "ON_LEAVE"
  | "UNAVAILABLE"
  | "OFF_DUTY"
  | "NOT_CHECKED_IN"
  | "CHECKED_OUT";

/**
 * Operational warnings.
 *
 * These are informational and never fail a request. They exist because the
 * database CANNOT enforce these invariants: Appointment carries no exclusion
 * constraint and its times are plain strings, so overlapping bookings are
 * physically possible. An admin needs to be told, not protected from the truth.
 */
export type WarningCode =
  | "DOUBLE_BOOKED"
  | "BOOKED_ON_LEAVE"
  | "BOOKED_ON_HOLIDAY"
  | "BOOKED_OUTSIDE_SHIFT"
  | "BOOKED_DURING_BREAK"
  | "BOOKED_WHILE_UNAVAILABLE"
  | "INVALID_APPOINTMENT_WINDOW"
  | "MULTIPLE_ACTIVE_SHIFTS"
  | "NO_SHIFT_ASSIGNED";

export type Warning = {
  code: WarningCode;
  message: string;
  appointmentIds: string[];
};

// ============================================================================
// TIME HELPERS
// ============================================================================

export type Interval = { start: number; end: number };

export function timeToMinutes(time: string): number {
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/** Collapse overlapping and touching ranges into a canonical, sorted set. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

/** base − cuts. Both sides are merged first so the result is always canonical. */
export function subtractIntervals(base: Interval[], cuts: Interval[]): Interval[] {
  const merged = mergeIntervals(cuts);
  let remaining = mergeIntervals(base);

  for (const cut of merged) {
    const next: Interval[] = [];

    for (const piece of remaining) {
      // Disjoint — the cut cannot touch this piece.
      if (cut.end <= piece.start || cut.start >= piece.end) {
        next.push(piece);
        continue;
      }
      if (cut.start > piece.start) next.push({ start: piece.start, end: cut.start });
      if (cut.end < piece.end) next.push({ start: cut.end, end: piece.end });
    }

    remaining = next;
  }

  return remaining;
}

/** a ∩ b. Used to clamp breaks, blocks and bookings into the shift window. */
export function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const left = mergeIntervals(a);
  const right = mergeIntervals(b);
  const result: Interval[] = [];

  for (const x of left) {
    for (const y of right) {
      const start = Math.max(x.start, y.start);
      const end = Math.min(x.end, y.end);
      if (start < end) result.push({ start, end });
    }
  }

  return mergeIntervals(result);
}

export function totalMinutes(intervals: Interval[]): number {
  return intervals.reduce((sum, i) => sum + (i.end - i.start), 0);
}

/** Half-open overlap test. Back-to-back ranges (10:00–11:00, 11:00–12:00) do NOT overlap. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

// ============================================================================
// PRISMA SELECTS
//
// Explicit throughout. A scheduling view has no business shipping an
// appointment's subtotal, taxAmount, internalNotes or payment fields to render a
// timeline row or a slot.
// ============================================================================

export const WORKER_SELECT = {
  id: true,
  employeeCode: true,
  firstName: true,
  lastName: true,
  displayName: true,
  isActive: true,
} satisfies Prisma.WorkerProfileSelect;

export const WORKER_SHIFT_SELECT = {
  id: true,
  shiftId: true,
  branchId: true,
  startDate: true,
  endDate: true,
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
} satisfies Prisma.WorkerShiftSelect;

export const APPOINTMENT_SELECT = {
  id: true,
  appointmentNo: true,
  startTime: true,
  endTime: true,
  totalDuration: true,
  status: true,
  chairCabinNo: true,
  branchId: true,
  customer: {
    select: { id: true, firstName: true, lastName: true },
  },
  services: {
    select: {
      id: true,
      serviceId: true,
      duration: true,
      status: true,
      service: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.AppointmentSelect;

export const AVAILABILITY_SELECT = {
  id: true,
  fromTime: true,
  toTime: true,
  reason: true,
} satisfies Prisma.WorkerAvailabilitySelect;

export const LEAVE_SELECT = {
  id: true,
  startDate: true,
  endDate: true,
  reason: true,
  leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
} satisfies Prisma.LeaveSelect;

export const ATTENDANCE_SELECT = {
  id: true,
  status: true,
  checkIn: true,
  checkOut: true,
  breakStart: true,
  breakEnd: true,
} satisfies Prisma.AttendanceSelect;

export const BRANCH_SELECT = {
  id: true,
  name: true,
  code: true,
  isActive: true,
} satisfies Prisma.BranchSelect;

export const BRANCH_TIMING_SELECT = {
  openTime: true,
  closeTime: true,
  isOpen: true,
  slotDuration: true,
} satisfies Prisma.BranchTimingSelect;

export type WorkerRow = Prisma.WorkerProfileGetPayload<{ select: typeof WORKER_SELECT }>;
export type WorkerShiftRow = Prisma.WorkerShiftGetPayload<{ select: typeof WORKER_SHIFT_SELECT }>;
export type AppointmentRow = Prisma.AppointmentGetPayload<{ select: typeof APPOINTMENT_SELECT }>;
export type AvailabilityRow = Prisma.WorkerAvailabilityGetPayload<{ select: typeof AVAILABILITY_SELECT }>;
export type LeaveRow = Prisma.LeaveGetPayload<{ select: typeof LEAVE_SELECT }>;
export type AttendanceRow = Prisma.AttendanceGetPayload<{ select: typeof ATTENDANCE_SELECT }>;
export type BranchRow = Prisma.BranchGetPayload<{ select: typeof BRANCH_SELECT }>;
export type BranchTimingRow = Prisma.BranchTimingGetPayload<{ select: typeof BRANCH_TIMING_SELECT }>;

// ============================================================================
// SHIFT RESOLUTION
// ============================================================================

export type ResolvedShift = {
  row: WorkerShiftRow;
  window: Interval | null;
  breakWindow: Interval | null;
  isRosteredToday: boolean;
};

/**
 * Pick the assignment in force on the requested date.
 *
 * WorkerShift carries NO uniqueness constraint, so more than one active row can
 * legitimately cover the same date. Rather than silently picking one and hiding
 * the ambiguity, the most recently effective assignment wins (callers pass rows
 * ordered startDate desc) and the caller is warned — an admin can only fix a
 * roster clash they can see.
 *
 * A worker can also be assigned to a shift whose workingDays exclude this weekday
 * (their weekly off). That is a real state, not an error: they hold the roster,
 * they just are not on it today.
 */
export function resolveShift(rows: WorkerShiftRow[], dayOfWeek: number): ResolvedShift | null {
  const row = rows[0];
  if (!row) return null;

  const isRosteredToday =
    row.shift.isActive && row.shift.workingDays.includes(dayOfWeek);

  if (!isRosteredToday) {
    return { row, window: null, breakWindow: null, isRosteredToday: false };
  }

  const start = timeToMinutes(row.shift.startTime);
  const end = timeToMinutes(row.shift.endTime);

  // A template with an inverted or zero-length window is corrupt data — nothing
  // in the schema forbids endTime <= startTime. Treat it as no working window
  // rather than producing negative minutes that would poison every metric.
  const window: Interval | null = end > start ? { start, end } : null;

  let breakWindow: Interval | null = null;
  if (window && row.shift.breakStart && row.shift.breakEnd) {
    const breakStart = timeToMinutes(row.shift.breakStart);
    const breakEnd = timeToMinutes(row.shift.breakEnd);

    if (breakEnd > breakStart) {
      // Clamped into the shift. An unclamped break that overhangs the shift would
      // let breakMinutes exceed workingMinutes and drive bookable minutes negative.
      const clamped = intersectIntervals([window], [{ start: breakStart, end: breakEnd }]);
      breakWindow = clamped[0] ?? null;
    }
  }

  return { row, window, breakWindow, isRosteredToday: true };
}

/**
 * The occupancy an appointment actually consumes.
 *
 * Appointment.startTime/endTime are strings with no CHECK constraint, so an
 * inverted window is possible. Those rows are excluded from the interval maths —
 * silently coercing them would corrupt every downstream metric — and reported as
 * a warning instead.
 */
export function toAppointmentInterval(appointment: AppointmentRow): Interval | null {
  const start = timeToMinutes(appointment.startTime);
  const end = timeToMinutes(appointment.endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return { start, end };
}

/** WorkerAvailability with null times means the whole day is blocked. */
export function toBlockedIntervals(blocks: AvailabilityRow[]): Interval[] {
  return blocks.map((block) => ({
    start: block.fromTime ? timeToMinutes(block.fromTime) : DAY_START_MINUTES,
    end: block.toTime ? timeToMinutes(block.toTime) : DAY_END_MINUTES,
  }));
}

/**
 * An approved leave takes the whole day. Leave.startDate/endDate are @db.Date
 * with no time component, so the schema offers no basis for a half-day.
 */
export function toLeaveIntervals(leave: LeaveRow | null): Interval[] {
  return leave ? [{ start: DAY_START_MINUTES, end: DAY_END_MINUTES }] : [];
}

/**
 * The minutes the BRANCH is open. Anything outside this is unbookable however
 * the worker's roster reads — a stylist rostered until 18:00 at a branch that
 * shuts at 17:00 cannot take a 17:30 customer.
 *
 * A holiday, a closed weekday, or a missing/corrupt timing row all collapse to
 * "shut all day".
 */
export function toOpenIntervals(
  timing: BranchTimingRow | null,
  isHoliday: boolean
): Interval[] {
  if (isHoliday || !timing || !timing.isOpen) return [];

  const open = timeToMinutes(timing.openTime);
  const close = timeToMinutes(timing.closeTime);
  if (!(close > open)) return [];

  return [{ start: open, end: close }];
}

// ============================================================================
// TIMELINE
// ============================================================================

export type Segment = {
  from: string;
  to: string;
  minutes: number;
  type: SegmentType;
};

/**
 * Carve the day into contiguous, non-overlapping segments covering 00:00–24:00.
 *
 * Layers are applied in descending precedence, each one claiming only the minutes
 * still unclaimed. BOOKED goes first deliberately: a customer commitment is the
 * one thing on this timeline that cannot simply be moved, so it must remain
 * visible even when it collides with a break or a leave day. The collision is
 * reported through warnings rather than by erasing the booking from the view.
 */
export function generateTimeline(
  shiftWindow: Interval | null,
  breakWindow: Interval | null,
  bookedIntervals: Interval[],
  blockedIntervals: Interval[],
  leaveIntervals: Interval[]
): Segment[] {
  const segments: Segment[] = [];
  let remaining: Interval[] = [{ start: DAY_START_MINUTES, end: DAY_END_MINUTES }];

  const claim = (layer: Interval[], type: SegmentType): void => {
    if (layer.length === 0) return;
    const claimed = intersectIntervals(remaining, layer);
    for (const piece of claimed) {
      segments.push({
        from: minutesToTime(piece.start),
        to: minutesToTime(piece.end),
        minutes: piece.end - piece.start,
        type,
      });
    }
    remaining = subtractIntervals(remaining, claimed);
  };

  claim(bookedIntervals, SEGMENT_BOOKED);
  claim(leaveIntervals, SEGMENT_LEAVE);
  claim(blockedIntervals, SEGMENT_BLOCKED);
  claim(breakWindow ? [breakWindow] : [], SEGMENT_BREAK);
  claim(shiftWindow ? [shiftWindow] : [], SEGMENT_FREE);

  // Whatever is left is outside the roster entirely.
  for (const piece of remaining) {
    segments.push({
      from: minutesToTime(piece.start),
      to: minutesToTime(piece.end),
      minutes: piece.end - piece.start,
      type: SEGMENT_OFF_DUTY,
    });
  }

  return segments.sort((a, b) => timeToMinutes(a.from) - timeToMinutes(b.from));
}

// ============================================================================
// METRICS
// ============================================================================

export type Metrics = {
  workingMinutes: number;
  breakMinutes: number;
  blockedMinutes: number;
  leaveMinutes: number;
  bookedMinutes: number;
  bookableMinutes: number;
  freeMinutes: number;
  remainingMinutes: number;
  utilizationPercent: number;
  capacityPercent: number;
  appointmentCount: number;
  completedAppointmentCount: number;
};

/**
 * BUSINESS FORMULA
 *
 *   bookableMinutes = workingMinutes − (break ∪ blocked ∪ leave), clamped to the shift
 *   utilization     = bookedMinutes / bookableMinutes
 *   capacity        = bookableMinutes / workingMinutes
 *
 * Note the UNION. Subtracting break, blocked and leave as three independent
 * figures — as the naive reading of the formula suggests — double-subtracts any
 * minute covered by two of them (a block laid over the lunch hour, say) and can
 * drive bookable minutes negative. The three are still reported individually
 * because an admin wants to see them, but the capacity maths uses the union.
 *
 * Everything is clamped to the shift window. A block or a booking sitting outside
 * the roster cannot reduce, or consume, capacity the worker never had — those are
 * surfaced as warnings instead.
 *
 * Utilization CAN exceed 100%. That is not a bug to be capped away: it means
 * booked time overlaps blocked or leave time, and the warnings array says which
 * appointments are responsible.
 */
export function calculateMetrics(
  shiftWindow: Interval | null,
  breakWindow: Interval | null,
  bookedIntervals: Interval[],
  blockedIntervals: Interval[],
  leaveIntervals: Interval[],
  appointments: AppointmentRow[],
  nowMinutes: number | null
): Metrics {
  const shift: Interval[] = shiftWindow ? [shiftWindow] : [];

  const workingMinutes = totalMinutes(shift);

  const breakInShift = intersectIntervals(shift, breakWindow ? [breakWindow] : []);
  const blockedInShift = intersectIntervals(shift, blockedIntervals);
  const leaveInShift = intersectIntervals(shift, leaveIntervals);
  const bookedInShift = intersectIntervals(shift, bookedIntervals);

  const nonBookable = mergeIntervals([...breakInShift, ...blockedInShift, ...leaveInShift]);

  const bookableMinutes = Math.max(0, workingMinutes - totalMinutes(nonBookable));
  const bookedMinutes = totalMinutes(bookedInShift);

  // Derived by interval subtraction rather than arithmetic, so it can never go
  // negative when a booking overlaps a block.
  const freeIntervals = subtractIntervals(shift, [...nonBookable, ...bookedInShift]);
  const freeMinutes = totalMinutes(freeIntervals);

  // Free capacity still ahead of the clock. Meaningless for a day that is not
  // today, where the whole free window is by definition still "remaining".
  const remainingMinutes =
    nowMinutes === null
      ? freeMinutes
      : totalMinutes(
          subtractIntervals(freeIntervals, [{ start: DAY_START_MINUTES, end: nowMinutes }])
        );

  const utilizationPercent =
    bookableMinutes === 0 ? 0 : Number(((bookedMinutes / bookableMinutes) * 100).toFixed(1));

  const capacityPercent =
    workingMinutes === 0 ? 0 : Number(((bookableMinutes / workingMinutes) * 100).toFixed(1));

  return {
    workingMinutes,
    breakMinutes: totalMinutes(breakInShift),
    blockedMinutes: totalMinutes(blockedInShift),
    leaveMinutes: totalMinutes(leaveInShift),
    bookedMinutes,
    bookableMinutes,
    freeMinutes,
    remainingMinutes,
    utilizationPercent,
    capacityPercent,
    appointmentCount: appointments.length,
    completedAppointmentCount: appointments.filter(
      (a) => a.status === AppointmentStatus.COMPLETED
    ).length,
  };
}

// ============================================================================
// CURRENT STATUS
// ============================================================================

export type CurrentStatus = {
  status: WorkerStatus;
  asOf: string;
  currentAppointmentId: string | null;
  nextAppointmentId: string | null;
};

/**
 * Where the worker stands right now.
 *
 * Only meaningful for the current day — a "current status" for last Tuesday is a
 * fiction — so the caller receives null for any other date rather than a
 * confidently wrong answer.
 *
 * ON_SERVICE is driven by AppointmentStatus.STARTED, not by the clock: startedAt
 * is stamped by the worker themselves, and an appointment whose slot has arrived
 * but which nobody has begun is not the same thing as one in progress.
 */
export function resolveCurrentStatus(
  nowMinutes: number | null,
  shift: ResolvedShift | null,
  leave: LeaveRow | null,
  attendance: AttendanceRow | null,
  appointments: AppointmentRow[],
  blockedIntervals: Interval[]
): CurrentStatus | null {
  if (nowMinutes === null) return null;

  const asOf = minutesToTime(nowMinutes);

  const inProgress = appointments.find((a) => a.status === AppointmentStatus.STARTED) ?? null;

  const next =
    appointments
      .filter((a) => {
        const interval = toAppointmentInterval(a);
        return interval !== null && interval.start > nowMinutes;
      })
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))[0] ?? null;

  const base = {
    asOf,
    currentAppointmentId: inProgress?.id ?? null,
    nextAppointmentId: next?.id ?? null,
  };

  const within = (intervals: Interval[]): boolean =>
    intervals.some((i) => nowMinutes >= i.start && nowMinutes < i.end);

  // A worker mid-service outranks every other reading: whatever the roster says,
  // they are demonstrably with a customer.
  if (inProgress) return { ...base, status: "ON_SERVICE" };

  if (leave) return { ...base, status: "ON_LEAVE" };
  if (!shift?.isRosteredToday || !shift.window) return { ...base, status: "OFF_DUTY" };
  if (attendance?.checkOut) return { ...base, status: "CHECKED_OUT" };
  if (within(blockedIntervals)) return { ...base, status: "UNAVAILABLE" };
  if (shift.breakWindow && within([shift.breakWindow])) return { ...base, status: "ON_BREAK" };
  if (!within([shift.window])) return { ...base, status: "OFF_DUTY" };

  // Rostered, on shift, nothing in the way — but they have not clocked in, which
  // is an operationally different state from being ready to take a customer.
  if (!attendance?.checkIn) return { ...base, status: "NOT_CHECKED_IN" };

  return { ...base, status: "AVAILABLE" };
}

// ============================================================================
// WARNINGS
// ============================================================================

/**
 * Contradictions the database is structurally incapable of preventing.
 *
 * Appointment has no exclusion constraint and its times are plain strings, so
 * overlapping bookings, bookings on a leave day and bookings outside the roster
 * all physically exist in the data. These are reported, never suppressed, and
 * never fail the request — the admin is the one who has to resolve them.
 */
export function collectWarnings(
  appointments: AppointmentRow[],
  shift: ResolvedShift | null,
  shiftRowCount: number,
  leave: LeaveRow | null,
  isHoliday: boolean,
  blockedIntervals: Interval[]
): Warning[] {
  const warnings: Warning[] = [];

  if (shiftRowCount > 1) {
    warnings.push({
      code: "MULTIPLE_ACTIVE_SHIFTS",
      message:
        "More than one active shift assignment covers this date. The most recently effective one is shown.",
      appointmentIds: [],
    });
  }

  if (shiftRowCount === 0) {
    warnings.push({
      code: "NO_SHIFT_ASSIGNED",
      message: "No shift assignment covers this date, so the worker has no rostered hours.",
      appointmentIds: [],
    });
  }

  const malformed: string[] = [];
  const valid: { id: string; interval: Interval }[] = [];

  for (const appointment of appointments) {
    const interval = toAppointmentInterval(appointment);
    if (!interval) {
      malformed.push(appointment.id);
      continue;
    }
    valid.push({ id: appointment.id, interval });
  }

  if (malformed.length) {
    warnings.push({
      code: "INVALID_APPOINTMENT_WINDOW",
      message: "One or more appointments have an end time at or before their start time.",
      appointmentIds: malformed,
    });
  }

  // Pairwise overlap. The day holds a handful of appointments per worker, so the
  // quadratic scan is cheaper than the sort-and-sweep it would replace.
  const overlapping = new Set<string>();
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const a = valid[i];
      const b = valid[j];
      if (overlaps(a.interval, b.interval)) {
        overlapping.add(a.id);
        overlapping.add(b.id);
      }
    }
  }
  if (overlapping.size) {
    warnings.push({
      code: "DOUBLE_BOOKED",
      message: "Appointments overlap each other. The worker cannot serve both.",
      appointmentIds: [...overlapping],
    });
  }

  if (valid.length && leave) {
    warnings.push({
      code: "BOOKED_ON_LEAVE",
      message: "Appointments are booked on a day the worker is on approved leave.",
      appointmentIds: valid.map((v) => v.id),
    });
  }

  if (valid.length && isHoliday) {
    warnings.push({
      code: "BOOKED_ON_HOLIDAY",
      message: "Appointments are booked on a branch holiday.",
      appointmentIds: valid.map((v) => v.id),
    });
  }

  const window = shift?.isRosteredToday ? shift.window : null;

  const outsideShift = valid
    .filter((v) => !window || v.interval.start < window.start || v.interval.end > window.end)
    .map((v) => v.id);
  if (outsideShift.length) {
    warnings.push({
      code: "BOOKED_OUTSIDE_SHIFT",
      message: "Appointments fall wholly or partly outside the worker's rostered hours.",
      appointmentIds: outsideShift,
    });
  }

  if (shift?.breakWindow) {
    const breakWindow = shift.breakWindow;
    const duringBreak = valid
      .filter((v) => overlaps(v.interval, breakWindow))
      .map((v) => v.id);
    if (duringBreak.length) {
      warnings.push({
        code: "BOOKED_DURING_BREAK",
        message: "Appointments overlap the worker's scheduled break.",
        appointmentIds: duringBreak,
      });
    }
  }

  if (blockedIntervals.length) {
    const blockedMerged = mergeIntervals(blockedIntervals);
    const whileBlocked = valid
      .filter((v) => blockedMerged.some((b) => overlaps(v.interval, b)))
      .map((v) => v.id);
    if (whileBlocked.length) {
      warnings.push({
        code: "BOOKED_WHILE_UNAVAILABLE",
        message: "Appointments overlap a window the worker is marked unavailable for.",
        appointmentIds: whileBlocked,
      });
    }
  }

  return warnings;
}

// ============================================================================
// SLOT GENERATION
// ============================================================================

/**
 * Slot statuses. A closed set — the booking surfaces switch on these, and an
 * unrecognised value would be rendered as bookable by a careless consumer.
 */
export type SlotStatus =
  | "FREE"
  | "BOOKED"
  | "BREAK"
  | "UNAVAILABLE"
  | "LEAVE"
  | "OFF_DUTY";

export type Slot = {
  start: string;
  end: string;
  duration: number;
  status: SlotStatus;
  appointmentId: string | null;
  availabilityId: string | null;
  leaveId: string | null;
  reason: string | null;
};

export type SlotInput = {
  shiftWindow: Interval;
  breakWindow: Interval | null;
  duration: number;
  appointments: AppointmentRow[];
  availabilityBlocks: AvailabilityRow[];
  leave: LeaveRow | null;
  openIntervals: Interval[];
};

/**
 * Build the bookable grid for one worker, one day.
 *
 * DOMAIN — the resolved shift window, and nothing else. A slot is never emitted
 * before the shift starts or after it ends, so the grid can never offer time the
 * worker was never rostered for. The walk steps by exactly `duration`, which is
 * what makes the output non-overlapping and duplicate-free by construction rather
 * than by a de-duplication pass afterwards.
 *
 * PRECEDENCE — identical to the timeline, with OFF_DUTY inserted above FREE:
 *
 *     BOOKED > LEAVE > UNAVAILABLE > BREAK > OFF_DUTY > FREE
 *
 * BOOKED still wins, for the same reason it wins on the timeline: an appointment
 * on a leave day is a real commitment to a real customer, and hiding it behind a
 * LEAVE label is how a salon double-books someone. OFF_DUTY sits directly above
 * FREE so that a slot inside the shift but outside the branch's opening hours —
 * or on a holiday — can never be sold.
 *
 * A slot is FREE only if it overlaps NOTHING. A partial overlap is still an
 * overlap: half a slot is not bookable.
 *
 * All occupancy sets are merged ONCE by the caller before they arrive here, so
 * classification is a scan over a handful of canonical ranges rather than over
 * every raw row. The source-row lookup that attaches appointmentId / leaveId /
 * availabilityId runs only for the slots that are actually occupied.
 */
export function generateSlots(input: SlotInput): Slot[] {
  const { shiftWindow, breakWindow, duration, appointments, availabilityBlocks, leave, openIntervals } =
    input;

  // Raw rows kept alongside their intervals so an occupied slot can name the
  // record responsible for it — the merged sets alone cannot.
  const bookedRows = appointments
    .map((a) => ({ row: a, interval: toAppointmentInterval(a) }))
    .filter((x): x is { row: AppointmentRow; interval: Interval } => x.interval !== null);

  const blockedRows = availabilityBlocks.map((b) => ({
    row: b,
    interval: {
      start: b.fromTime ? timeToMinutes(b.fromTime) : DAY_START_MINUTES,
      end: b.toTime ? timeToMinutes(b.toTime) : DAY_END_MINUTES,
    },
  }));

  const bookedMerged = mergeIntervals(bookedRows.map((x) => x.interval));
  const blockedMerged = mergeIntervals(blockedRows.map((x) => x.interval));
  const leaveMerged = toLeaveIntervals(leave);
  const breakMerged = breakWindow ? [breakWindow] : [];
  const openMerged = mergeIntervals(openIntervals);

  const hits = (slot: Interval, set: Interval[]): boolean => set.some((i) => overlaps(slot, i));

  const slots: Slot[] = [];

  // `start + duration <= end` is what guarantees the grid never overruns the
  // shift: a trailing remainder too small to hold a whole slot is simply not
  // offered, because a partial slot cannot be booked.
  for (
    let start = shiftWindow.start;
    start + duration <= shiftWindow.end;
    start += duration
  ) {
    const slot: Interval = { start, end: start + duration };

    if (hits(slot, bookedMerged)) {
      const hit = bookedRows.find((x) => overlaps(slot, x.interval));
      slots.push({
        start: minutesToTime(slot.start),
        end: minutesToTime(slot.end),
        duration,
        status: "BOOKED",
        appointmentId: hit?.row.id ?? null,
        availabilityId: null,
        leaveId: null,
        reason: hit ? `Appointment ${hit.row.appointmentNo}` : null,
      });
      continue;
    }

    if (hits(slot, leaveMerged)) {
      slots.push({
        start: minutesToTime(slot.start),
        end: minutesToTime(slot.end),
        duration,
        status: "LEAVE",
        appointmentId: null,
        availabilityId: null,
        leaveId: leave?.id ?? null,
        reason: leave?.leaveType.name ?? null,
      });
      continue;
    }

    if (hits(slot, blockedMerged)) {
      const hit = blockedRows.find((x) => overlaps(slot, x.interval));
      slots.push({
        start: minutesToTime(slot.start),
        end: minutesToTime(slot.end),
        duration,
        status: "UNAVAILABLE",
        appointmentId: null,
        availabilityId: hit?.row.id ?? null,
        leaveId: null,
        reason: hit?.row.reason ?? null,
      });
      continue;
    }

    if (hits(slot, breakMerged)) {
      slots.push({
        start: minutesToTime(slot.start),
        end: minutesToTime(slot.end),
        duration,
        status: "BREAK",
        appointmentId: null,
        availabilityId: null,
        leaveId: null,
        reason: "Scheduled break",
      });
      continue;
    }

    // Inside the roster, but the branch is shut — a holiday, a closed weekday, or
    // a shift that runs past closing time. Never sellable, whatever the roster says.
    if (!hits(slot, openMerged)) {
      slots.push({
        start: minutesToTime(slot.start),
        end: minutesToTime(slot.end),
        duration,
        status: "OFF_DUTY",
        appointmentId: null,
        availabilityId: null,
        leaveId: null,
        reason: "Branch is closed",
      });
      continue;
    }

    slots.push({
      start: minutesToTime(slot.start),
      end: minutesToTime(slot.end),
      duration,
      status: "FREE",
      appointmentId: null,
      availabilityId: null,
      leaveId: null,
      reason: null,
    });
  }

  return slots;
}

export type SlotSummary = {
  totalSlots: number;
  freeSlots: number;
  bookedSlots: number;
  unavailableSlots: number;
  breakSlots: number;
  leaveSlots: number;
  offDutySlots: number;
  occupancyPercent: number;
};

/**
 * Occupancy is booked ÷ (booked + free) — the slots that were ever SELLABLE.
 *
 * Dividing by totalSlots would punish a worker for approved leave and a branch
 * holiday: someone whose remaining two free hours are fully booked is 100%
 * occupied, not 25%. This mirrors utilizationPercent in calculateMetrics, which
 * divides booked minutes by BOOKABLE minutes for exactly the same reason.
 */
export function summariseSlots(slots: Slot[]): SlotSummary {
  const count = (status: SlotStatus): number =>
    slots.reduce((n, s) => (s.status === status ? n + 1 : n), 0);

  const freeSlots = count("FREE");
  const bookedSlots = count("BOOKED");
  const sellable = freeSlots + bookedSlots;

  return {
    totalSlots: slots.length,
    freeSlots,
    bookedSlots,
    unavailableSlots: count("UNAVAILABLE"),
    breakSlots: count("BREAK"),
    leaveSlots: count("LEAVE"),
    offDutySlots: count("OFF_DUTY"),
    occupancyPercent:
      sellable === 0 ? 0 : Number(((bookedSlots / sellable) * 100).toFixed(1)),
  };
}
