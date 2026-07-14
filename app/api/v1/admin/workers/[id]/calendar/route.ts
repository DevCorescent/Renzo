// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Management — Calendar
// ROUTE  : /api/v1/admin/workers/[id]/calendar
//
// METHODS
// GET    - Worker monthly calendar
//
// ACCESS
// GET    - SUPER_ADMIN, OWNER, BRANCH_ADMIN
// ============================================================================

import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

import prisma from "@/lib/db";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";

import type { AuthUser } from "@/types/api";

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
  toAppointmentInterval,
  toBlockedIntervals,
  toLeaveIntervals,
  toOpenIntervals,
  subtractIntervals,
  calculateMetrics,
} from "@/lib/scheduling";

// ============================================================================
// CONSTANTS
// ============================================================================

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^(0?[1-9]|1[0-2])$/;

const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

type CalendarDayStatus =
  | "AVAILABLE"
  | "FULLY_BOOKED"
  | "PARTIALLY_BOOKED"
  | "ON_LEAVE"
  | "HOLIDAY"
  | "OFF_DUTY";

type CalendarDay = {
  date: string;
  dayOfWeek: number;

  status: CalendarDayStatus;

  appointments: number;

  bookedMinutes: number;

  freeMinutes: number;

  leave: boolean;

  holiday: boolean;

  shiftAssigned: boolean;
};

type CalendarSummary = {
  workingDays: number;

  leaveDays: number;

  holidayDays: number;

  bookedDays: number;

  freeDays: number;

  totalAppointments: number;

  utilizationPercent: number;
};

// ============================================================================
// AUTHORIZATION
// Mirrors Worker CRUD / Schedule / Slots
// ============================================================================

async function authorizeWorkerAccess(
  user: AuthUser,
  id: string
): Promise<
  | {
      worker: { id: string };
      error: null;
    }
  | {
      worker: null;
      error: ReturnType<typeof err>;
    }
> {
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
      branches: {
        select: {
          branchId: true,
          isActive: true,
        },
      },
    },
  });

  if (!worker) {
    return {
      worker: null,
      error: err("Worker not found", 404),
    };
  }

  if (
    user.userType === "BRANCH_ADMIN" &&
    !worker.branches.some(
      (branch) =>
        branch.branchId === user.branchId &&
        branch.isActive
    )
  ) {
    return {
      worker: null,
      error: err(
        "Forbidden — worker belongs to another branch",
        403
      ),
    };
  }

  return {
    worker: {
      id: worker.id,
    },
    error: null,
  };
}
// ============================================================================
// DATE HELPERS
//
// Calendar is month-based.
//
// All calculations are performed in UTC because the schema stores
// appointmentDate/startDate/endDate as @db.Date without timezone.
//
// This keeps behaviour identical to Schedule and Slots.
// ============================================================================

function isLeapYear(year: number): boolean {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;

    case 4:
    case 6:
    case 9:
    case 11:
      return 30;

    default:
      return 31;
  }
}

function startOfMonthUTC(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

function endOfMonthUTC(year: number, month: number): Date {
  return new Date(Date.UTC(year, month, 0));
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Inclusive month iterator.
 *
 * Produces every UTC calendar day inside the month.
 */
function buildMonthDays(
  year: number,
  month: number
): Date[] {
  const totalDays = daysInMonth(year, month);

  const first = startOfMonthUTC(year, month);

  return Array.from(
    { length: totalDays },
    (_, index) => addDays(first, index)
  );
}

// ============================================================================
// QUERY VALIDATION
// ============================================================================

type CalendarQuery = {
  year: number;
  month: number;

  monthStart: Date;
  monthEnd: Date;

  todayKey: string;

  days: Date[];
};

function parseCalendarQuery(
  req: NextRequest
):
  | {
      value: CalendarQuery;
      error: null;
    }
  | {
      value: null;
      error: ReturnType<typeof err>;
    } {
  const url = new URL(req.url);

  const errors: Record<string, string[]> = {};

  const rawYear =
    url.searchParams.get("year")?.trim() ??
    String(new Date().getUTCFullYear());

  const rawMonth =
    url.searchParams.get("month")?.trim() ??
    String(new Date().getUTCMonth() + 1);

  if (!YEAR_RE.test(rawYear)) {
    errors.year = [
      "Year must be a four digit number.",
    ];
  }

  if (!MONTH_RE.test(rawMonth)) {
    errors.month = [
      "Month must be between 1 and 12.",
    ];
  }

  if (Object.keys(errors).length) {
    return {
      value: null,
      error: err(
        "Validation failed",
        422,
        errors
      ),
    };
  }

  const year = Number(rawYear);
  const month = Number(rawMonth);

  if (
    year < MIN_YEAR ||
    year > MAX_YEAR
  ) {
    return {
      value: null,
      error: err(
        "Validation failed",
        422,
        {
          year: [
            `Year must be between ${MIN_YEAR} and ${MAX_YEAR}.`,
          ],
        }
      ),
    };
  }

  const monthStart = startOfMonthUTC(
    year,
    month
  );

  const monthEnd = endOfMonthUTC(
    year,
    month
  );

  return {
    value: {
      year,
      month,
      monthStart,
      monthEnd,
      todayKey: toDateKey(new Date()),
      days: buildMonthDays(year, month),
    },
    error: null,
  };
}
// ============================================================================
// BULK DATA LOADING
//
// Calendar loads an ENTIRE MONTH in one pass.
//
// Never query day-by-day.
//
// That would create:
//
// 31 × appointments
// 31 × shifts
// 31 × holidays
// ...
//
// Instead everything is fetched once and grouped in memory.
// ============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Roles are enumerated exactly as in Worker CRUD / Schedule / Slots. An
  // unqualified requireAuth(req) authenticates but authorises nothing — a
  // CUSTOMER or a WORKER holding a valid session would sail straight through
  // into another employee's calendar.
  const { user, error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN"
  );

  if (error) return error;

  try {
    const { id } = await params;

    // Authorization precedes validation, matching Schedule and Slots and the
    // module's stated pipeline. Validating first would answer a caller who has no
    // right to this worker with a 422 about their query string — confirming the
    // worker exists before establishing that they may see it.
    const access = await authorizeWorkerAccess(
      user,
      id
    );

    if (access.error) return access.error;

    const parsed = parseCalendarQuery(req);

    if (parsed.error) return parsed.error;

    const { year, month, monthStart, monthEnd, days } =
      parsed.value;

    const [
  worker,
  workerShifts,
  appointments,
  availabilityBlocks,
  approvedLeaves,
  membership,
] = await Promise.all([
  prisma.workerProfile.findUnique({
    where: {
      id,
    },
    select: WORKER_SELECT,
  }),

  prisma.workerShift.findMany({
    where: {
      workerId: id,
      isActive: true,

      startDate: {
        lte: monthEnd,
      },

      OR: [
        {
          endDate: null,
        },
        {
          endDate: {
            gte: monthStart,
          },
        },
      ],
    },

    orderBy: [
      {
        startDate: "desc",
      },
      {
        id: "asc",
      },
    ],

    select: WORKER_SHIFT_SELECT,
  }),

  prisma.appointment.findMany({
    where: {
      workerId: id,

      appointmentDate: {
        gte: monthStart,
        lte: monthEnd,
      },

      status: {
        notIn: NON_OCCUPYING_STATUSES,
      },
    },

    orderBy: [
      {
        appointmentDate: "asc",
      },
      {
        startTime: "asc",
      },
      {
        id: "asc",
      },
    ],

    // The shared engine select is day-agnostic — Schedule and Slots already know
    // the date they asked for. The calendar spans a month, so it must also carry
    // appointmentDate back to bucket each row into its day.
    select: {
      ...APPOINTMENT_SELECT,
      appointmentDate: true,
    },
  }),

  prisma.workerAvailability.findMany({
    where: {
      workerId: id,

      date: {
        gte: monthStart,
        lte: monthEnd,
      },
    },

    orderBy: [
      {
        date: "asc",
      },
      {
        fromTime: "asc",
      },
      {
        id: "asc",
      },
    ],

    // Same reason as the appointment select above: a month-wide read has to know
    // which day each block belongs to.
    select: {
      ...AVAILABILITY_SELECT,
      date: true,
    },
  }),

  prisma.leave.findMany({
    where: {
      workerId: id,

      status: "APPROVED",

      startDate: {
        lte: monthEnd,
      },

      endDate: {
        gte: monthStart,
      },
    },

    orderBy: [
      {
        startDate: "asc",
      },
    ],

    select: LEAVE_SELECT,
  }),

  prisma.workerBranch.findFirst({
    where: {
      workerId: id,
      isActive: true,
    },

    orderBy: {
      isPrimary: "desc",
    },

    select: {
      branchId: true,
    },
  }),
]);

if (!worker) {
  return err("Worker not found", 404);
}

// ============================================================================
// Resolve Branch Context
//
// Shift branch wins.
//
// If no shift exists, fallback to the worker's primary branch.
// ============================================================================

const branchId =
  workerShifts[0]?.branchId ??
  membership?.branchId ??
  null;

const [
  branch,
  branchTimings,
  holidays,
] = await Promise.all([
  branchId
    ? prisma.branch.findUnique({
        where: {
          id: branchId,
        },
        select: BRANCH_SELECT,
      })
    : Promise.resolve(null),

  branchId
    ? prisma.branchTiming.findMany({
        where: {
          branchId,
        },

        orderBy: {
          dayOfWeek: "asc",
        },

        // All seven rows are fetched once and matched per day in memory. The
        // shared select omits dayOfWeek because Schedule and Slots look a single
        // weekday up by unique key; the calendar has to match on it.
        select: {
          ...BRANCH_TIMING_SELECT,
          dayOfWeek: true,
        },
      })
    : Promise.resolve([]),

  branchId
    ? prisma.branchHoliday.findMany({
        where: {
          branchId,

          date: {
            gte: monthStart,
            lte: monthEnd,
          },
        },

        orderBy: {
          date: "asc",
        },

        select: {
          id: true,
          date: true,
          reason: true,
        },
      })
    : Promise.resolve([]),
]);

if (!branchId || !branch) {
  return err(
    "Worker is not assigned to any active branch",
    404
  );
}

// A deactivated worker, or a deactivated branch, cannot be rostered anywhere —
// so no day in the month is bookable. Slots already refuses to emit a grid for
// either case (WORKER_INACTIVE / BRANCH_INACTIVE); without this the calendar
// would contradict it by painting the whole month AVAILABLE.
const rosterSuspended = !worker.isActive || !branch.isActive;
// ============================================================================
// BUILD MONTH CALENDAR
//
// Everything below is pure in-memory computation.
//
// We first group month data by YYYY-MM-DD so each calendar day becomes an O(1)
// lookup instead of repeatedly filtering arrays.
// ============================================================================

const appointmentsByDate = new Map<string, typeof appointments>();
const availabilityByDate = new Map<string, typeof availabilityBlocks>();
const holidaysByDate = new Map<string, (typeof holidays)[number]>();

for (const holiday of holidays) {
  holidaysByDate.set(toDateKey(holiday.date), holiday);
}

for (const appointment of appointments) {
  const key = toDateKey(appointment.appointmentDate);

  const existing = appointmentsByDate.get(key);

  if (existing) {
    existing.push(appointment);
  } else {
    appointmentsByDate.set(key, [appointment]);
  }
}

for (const block of availabilityBlocks) {
  const key = toDateKey(block.date);

  const existing = availabilityByDate.get(key);

  if (existing) {
    existing.push(block);
  } else {
    availabilityByDate.set(key, [block]);
  }
}

// BranchTiming holds at most seven rows, but it was being re-scanned for every
// day of the month. Keyed once, the weekday lookup becomes O(1).
const timingsByWeekday = new Map<
  number,
  (typeof branchTimings)[number]
>();

for (const timing of branchTimings) {
  timingsByWeekday.set(timing.dayOfWeek, timing);
}

// Leaves and shifts are date RANGES, not single days, so unlike appointments they
// cannot be keyed straight off a column. Each range is instead expanded ONCE
// across the days it actually covers — clipped to this month — which collapses
// the per-day .find()/.filter() scans into O(1) lookups.
//
// Insertion order is preserved so the semantics are byte-for-byte unchanged:
//   • leaves — first match wins, exactly as .find() did (rows arrive startDate asc)
//   • shifts — most recently effective first, which is precisely the ordering
//              resolveShift() relies on to break a roster clash (rows arrive
//              startDate desc, id asc)
const leavesByDate = new Map<
  string,
  (typeof approvedLeaves)[number]
>();

const shiftsByDate = new Map<
  string,
  typeof workerShifts
>();

const expandRange = (
  start: Date,
  end: Date | null,
  visit: (key: string) => void
): void => {
  // Clipped to the requested month. A leave running March→December must not walk
  // 300 days to fill a 31-day calendar, and an open-ended shift (endDate null)
  // would otherwise never terminate.
  let cursor = start > monthStart ? start : monthStart;

  const last =
    end && end < monthEnd ? end : monthEnd;

  while (cursor <= last) {
    visit(toDateKey(cursor));
    cursor = addDays(cursor, 1);
  }
};

for (const approvedLeave of approvedLeaves) {
  expandRange(
    approvedLeave.startDate,
    approvedLeave.endDate,
    (key) => {
      if (!leavesByDate.has(key)) {
        leavesByDate.set(key, approvedLeave);
      }
    }
  );
}

for (const workerShift of workerShifts) {
  expandRange(
    workerShift.startDate,
    workerShift.endDate,
    (key) => {
      const existing = shiftsByDate.get(key);

      if (existing) {
        existing.push(workerShift);
      } else {
        shiftsByDate.set(key, [workerShift]);
      }
    }
  );
}

const calendar: CalendarDay[] = [];

for (const day of days) {
  const dateKey = toDateKey(day);

  const weekday = day.getUTCDay();

  const dayAppointments =
    appointmentsByDate.get(dateKey) ?? [];

  const dayAvailability =
    availabilityByDate.get(dateKey) ?? [];

  const holiday =
    holidaysByDate.get(dateKey) ?? null;

  const leave =
    leavesByDate.get(dateKey) ?? null;

  const shiftRows =
    shiftsByDate.get(dateKey) ?? [];

  const shift = resolveShift(
    shiftRows,
    weekday
  );

  const timing =
    timingsByWeekday.get(weekday) ?? null;

  const shiftWindow =
    rosterSuspended
      ? null
      : shift?.window ?? null;

  // Branch opening hours are availability, not decoration. A stylist rostered
  // until 18:00 at a branch that shuts at 17:00 cannot take a 17:30 customer,
  // and a holiday closes the day outright — toOpenIntervals() collapses both to
  // "no open minutes".
  //
  // The closed minutes inside the shift are folded into `blocked` so that the
  // engine subtracts them exactly as it subtracts an availability block. Without
  // this the calendar would report a full shift of freeMinutes on a day the
  // doors never opened, and Slots — which already refuses those slots — would
  // disagree with it.
  const openIntervals =
    toOpenIntervals(timing, holiday !== null);

  const closedWithinShift =
    shiftWindow
      ? subtractIntervals([shiftWindow], openIntervals)
      : [];

  const blocked = [
    ...toBlockedIntervals(dayAvailability),
    ...closedWithinShift,
  ];

  const leaveIntervals =
    toLeaveIntervals(leave);

  const booked = dayAppointments
    .map(toAppointmentInterval)
    .filter(
      (
        interval
      ): interval is NonNullable<
        ReturnType<typeof toAppointmentInterval>
      > => interval !== null
    );

  const metrics = calculateMetrics(
    shiftWindow,
    shift?.breakWindow ?? null,
    booked,
    blocked,
    leaveIntervals,
    dayAppointments,
    null
  );

  let status: CalendarDayStatus;

  if (leave) {
    status = "ON_LEAVE";
  } else if (holiday) {
    status = "HOLIDAY";
  } else if (!shiftWindow) {
    status = "OFF_DUTY";
  } else if (
    // Rostered, but nothing on this day is sellable — the branch is shut, or a
    // full-day block covers the shift. AVAILABLE would be a lie the booking
    // screen would act on, and Slots already emits no slots here.
    metrics.bookableMinutes === 0
  ) {
    status = "OFF_DUTY";
  } else if (
    metrics.freeMinutes === 0
  ) {
    status = "FULLY_BOOKED";
  } else if (
    metrics.bookedMinutes > 0
  ) {
    status = "PARTIALLY_BOOKED";
  } else {
    status = "AVAILABLE";
  }

  calendar.push({
    date: dateKey,

    dayOfWeek: weekday,

    status,

    appointments:
      dayAppointments.length,

    bookedMinutes:
      metrics.bookedMinutes,

    freeMinutes:
      metrics.freeMinutes,

    leave: leave !== null,

    holiday: holiday !== null,

    // `shift?.window !== null` was inverted: with no shift at all, optional
    // chaining yields undefined, and `undefined !== null` is TRUE — so an
    // unrostered worker was reported as having a shift, and every such day was
    // counted into summary.workingDays.
    shiftAssigned:
      shiftWindow !== null,
  });
}
// ============================================================================
// MONTH SUMMARY
//
// Derived entirely from the computed calendar.
//
// We intentionally derive everything from the final calendar instead of the raw
// Prisma rows so every number shown to the user is internally consistent with
// what the calendar actually renders.
// ============================================================================

const workingDays = calendar.filter(
  (day) => day.shiftAssigned
).length;

const leaveDays = calendar.filter(
  (day) => day.leave
).length;

const holidayDays = calendar.filter(
  (day) => day.holiday
).length;

const bookedDays = calendar.filter(
  (day) =>
    day.status === "PARTIALLY_BOOKED" ||
    day.status === "FULLY_BOOKED"
).length;

const freeDays = calendar.filter(
  (day) => day.status === "AVAILABLE"
).length;

const totalAppointments = calendar.reduce(
  (total, day) => total + day.appointments,
  0
);

const totalBookedMinutes = calendar.reduce(
  (total, day) => total + day.bookedMinutes,
  0
);

const totalFreeMinutes = calendar.reduce(
  (total, day) => total + day.freeMinutes,
  0
);

// Capacity for the month = booked + free.
//
// Leave, holidays and off-duty days are intentionally excluded because they are
// not sellable capacity. This mirrors the scheduling engine's utilization logic.
const totalCapacityMinutes =
  totalBookedMinutes + totalFreeMinutes;

const utilizationPercent =
  totalCapacityMinutes === 0
    ? 0
    : Number(
        (
          (totalBookedMinutes /
            totalCapacityMinutes) *
          100
        ).toFixed(1)
      );

const summary: CalendarSummary = {
  workingDays,

  leaveDays,

  holidayDays,

  bookedDays,

  freeDays,

  totalAppointments,

  utilizationPercent,
};
    // ------------------------------------------------------------------------
    // SUCCESS
    // ------------------------------------------------------------------------

    return ok(
      {
        worker,
        branch,

        year,
        month,

        summary,

        calendar,
      },
      "Worker calendar fetched successfully"
    );
  } catch (e: unknown) {
    // ----------------------------------------------------------------------
    // Prisma
    // ----------------------------------------------------------------------

    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      switch (e.code) {
        case "P2025":
          return err("Worker not found", 404);

        case "P2003":
          return err("Worker not found", 404);

        default:
          return err("Database error", 500);
      }
    }

    // ----------------------------------------------------------------------
    // Unknown
    // ----------------------------------------------------------------------

    console.error(e);

    return err("Internal server error", 500);
  }
}