// ============================================================================
// MODULE : Attendance — data layer
//
// The Prisma-facing half of the attendance engine. lib/attendance.ts is pure
// arithmetic; this module loads the rows that arithmetic needs and writes the
// results back.
//
// It exists so that "recompute this record" is ONE function. Every write path —
// a worker clocking in, a receptionist clocking someone else in, an admin editing
// a timestamp, a bulk mark — funnels through `buildRecordFields()`, so no surface
// can persist a working-hours figure the others would disagree with.
// ============================================================================

import type { AttendanceStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { branchWhere, type BranchScope } from "@/lib/branch-scope";
import {
  ATTENDANCE_STATUSES,
  anchorShift,
  attendanceDateKey,
  computeMetrics,
  deriveStatus,
  formatDateKey,
  localDayOfWeek,
  parseDateKey,
  type AnchoredShift,
  type AttendanceMetrics,
} from "@/lib/attendance";

type Db = Prisma.TransactionClient | typeof prisma;

// ============================================================================
// SELECT SHAPES
// ============================================================================

/**
 * The row every attendance table, export and detail view renders.
 *
 * Explicit rather than `include: true` so the wire contract is visible here and a
 * new column cannot leak into an export by accident.
 */
export const ATTENDANCE_SELECT = {
  id: true,
  date: true,
  status: true,
  checkIn: true,
  checkOut: true,
  breakStart: true,
  breakEnd: true,
  workingMinutes: true,
  breakMinutes: true,
  lateMinutes: true,
  earlyArrivalMinutes: true,
  earlyLeaveMinutes: true,
  overtimeMinutes: true,
  overtimeApproved: true,
  isLocked: true,
  isManual: true,
  manualReason: true,
  manualCreatedBy: true,
  manualCreatedAt: true,
  approvedBy: true,
  approvedAt: true,
  lateOverrideMinutes: true,
  overtimeOverrideMinutes: true,
  notes: true,
  markedBy: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, name: true, code: true } },
  shift: {
    select: { id: true, name: true, startTime: true, endTime: true, graceMinutes: true },
  },
  worker: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      employeeCode: true,
      profilePhoto: true,
      designation: { select: { name: true } },
    },
  },
} satisfies Prisma.AttendanceSelect;

export type AttendanceRecord = Prisma.AttendanceGetPayload<{
  select: typeof ATTENDANCE_SELECT;
}>;

/** The minimal shape `summarizeAttendance()` needs — used by reports and cards. */
export const ATTENDANCE_METRIC_SELECT = {
  status: true,
  workingMinutes: true,
  overtimeMinutes: true,
  lateMinutes: true,
  breakMinutes: true,
  checkIn: true,
  checkOut: true,
} satisfies Prisma.AttendanceSelect;

// ============================================================================
// DAY CONTEXT — roster, holiday, leave
// ============================================================================

export type AttendanceContext = {
  shiftId: string | null;
  shift: AnchoredShift | null;
  shiftName: string | null;
  isHoliday: boolean;
  isOnLeave: boolean;
};

export const EMPTY_CONTEXT: AttendanceContext = {
  shiftId: null,
  shift: null,
  shiftName: null,
  isHoliday: false,
  isOnLeave: false,
};

type ContextKey = string;

function contextKey(workerId: string, date: Date): ContextKey {
  return `${workerId}|${formatDateKey(date)}`;
}

export type ContextRequest = {
  workerId: string;
  branchId: string;
  date: Date;
};

/**
 * Load roster + holiday + leave for many (worker, date) pairs in a fixed number
 * of queries.
 *
 * Three round trips TOTAL regardless of how many workers are passed — a 60-worker
 * bulk mark costs the same as a single check-in. The per-item alternative would
 * be 180 queries and is exactly the pattern this module exists to prevent.
 */
export async function loadAttendanceContexts(
  db: Db,
  requests: ContextRequest[]
): Promise<Map<ContextKey, AttendanceContext>> {
  const result = new Map<ContextKey, AttendanceContext>();
  if (requests.length === 0) return result;

  const workerIds = [...new Set(requests.map((r) => r.workerId))];
  const branchIds = [...new Set(requests.map((r) => r.branchId))];
  const times = requests.map((r) => r.date.getTime());
  const minDate = new Date(Math.min(...times));
  const maxDate = new Date(Math.max(...times));

  const [shiftRows, holidays, leaves] = await Promise.all([
    // Every roster assignment that could cover any requested date. `endDate: null`
    // is an open-ended assignment and must not be filtered out.
    db.workerShift.findMany({
      where: {
        workerId: { in: workerIds },
        isActive: true,
        startDate: { lte: maxDate },
        OR: [{ endDate: null }, { endDate: { gte: minDate } }],
      },
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        workerId: true,
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
            graceMinutes: true,
            isActive: true,
          },
        },
      },
    }),

    db.branchHoliday.findMany({
      where: { branchId: { in: branchIds }, date: { gte: minDate, lte: maxDate } },
      select: { branchId: true, date: true },
    }),

    db.leave.findMany({
      where: {
        workerId: { in: workerIds },
        status: "APPROVED",
        startDate: { lte: maxDate },
        endDate: { gte: minDate },
      },
      select: { workerId: true, startDate: true, endDate: true },
    }),
  ]);

  const holidaySet = new Set(holidays.map((h) => `${h.branchId}|${formatDateKey(h.date)}`));

  for (const request of requests) {
    const key = contextKey(request.workerId, request.date);
    if (result.has(key)) continue;

    const time = request.date.getTime();

    // Most recently effective assignment covering this date wins — the same rule
    // lib/scheduling.ts resolveShift() applies, since rows arrive startDate desc.
    const assignment = shiftRows.find(
      (row) =>
        row.workerId === request.workerId &&
        row.startDate.getTime() <= time &&
        (row.endDate === null || row.endDate.getTime() >= time)
    );

    const anchored = assignment ? anchorShift(request.date, assignment.shift) : null;

    const isOnLeave = leaves.some(
      (l) =>
        l.workerId === request.workerId &&
        l.startDate.getTime() <= time &&
        l.endDate.getTime() >= time
    );

    result.set(key, {
      shiftId: assignment?.shift.id ?? null,
      shift: anchored,
      shiftName: assignment?.shift.name ?? null,
      isHoliday: holidaySet.has(`${request.branchId}|${formatDateKey(request.date)}`),
      isOnLeave,
    });
  }

  return result;
}

/** Single-record convenience over {@link loadAttendanceContexts}. */
export async function loadAttendanceContext(
  db: Db,
  request: ContextRequest
): Promise<AttendanceContext> {
  const map = await loadAttendanceContexts(db, [request]);
  return map.get(contextKey(request.workerId, request.date)) ?? EMPTY_CONTEXT;
}

// ============================================================================
// RECORD ASSEMBLY
// ============================================================================

export type RecordTimes = {
  checkIn: Date | null;
  checkOut: Date | null;
  breakStart: Date | null;
  breakEnd: Date | null;
};

export type RecordFields = AttendanceMetrics & {
  status: AttendanceStatus;
  shiftId: string | null;
};

/**
 * Turn timestamps + day context into the exact column set to persist.
 *
 * `statusOverride` is the admin's explicit choice from a Mark/Edit dialog and
 * always wins: "mark absent" must mean absent even on a day the engine would have
 * derived something else. When it is absent — a worker clocking in, a receptionist
 * clocking them out — the status is DERIVED, which is what makes LATE and HALF_DAY
 * appear without anyone selecting them.
 */
export function buildRecordFields(
  date: Date,
  times: RecordTimes,
  context: AttendanceContext,
  statusOverride?: AttendanceStatus | null
): RecordFields {
  const metrics = computeMetrics({ ...times, shift: context.shift });

  const status =
    statusOverride ??
    deriveStatus({
      hasCheckIn: times.checkIn !== null,
      hasCheckOut: times.checkOut !== null,
      workingMinutes: metrics.workingMinutes,
      lateMinutes: metrics.lateMinutes,
      isHoliday: context.isHoliday,
      isOnLeave: context.isOnLeave,
      isRostered: context.shift ? context.shift.isRostered : null,
      scheduledMinutes: context.shift?.scheduledMinutes ?? 0,
    });

  // Keep the roster the metrics were derived from. Without this a later shift
  // reassignment would leave a row whose late-minutes cite a shift it never ran
  // against, and `date` is only used here to keep the signature honest about what
  // the context was resolved for.
  void date;

  return { ...metrics, status, shiftId: context.shiftId };
}

/** What a caller may override, in the three-state form the PATCH contract uses. */
export type OverrideInput = {
  /** undefined = leave as stored · null = clear · number = set. */
  lateOverrideMinutes?: number | null;
  overtimeOverrideMinutes?: number | null;
};

export type OverriddenFields = RecordFields & {
  lateOverrideMinutes: number | null;
  overtimeOverrideMinutes: number | null;
};

/**
 * Let a supervisor's correction win over the engine's arithmetic.
 *
 * The override is stored SEPARATELY and then copied into `lateMinutes` /
 * `overtimeMinutes`, which stay the single effective figures every report, export
 * and total already read. That is the whole point of doing it this way: payroll
 * does not need to learn about overrides, while the audit trail can still show
 * that the number was corrected by hand and what the engine had computed.
 *
 * Clearing an override (null) recomputes from the timestamps on the next write —
 * the derived value is passed in fresh every time, never read back from the row.
 */
export function applyOverrides(
  derived: RecordFields,
  input: OverrideInput,
  existing?: { lateOverrideMinutes: number | null; overtimeOverrideMinutes: number | null } | null
): OverriddenFields {
  const resolve = (sent: number | null | undefined, stored: number | null | undefined) =>
    sent === undefined ? stored ?? null : sent;

  const lateOverride = resolve(input.lateOverrideMinutes, existing?.lateOverrideMinutes);
  const overtimeOverride = resolve(
    input.overtimeOverrideMinutes,
    existing?.overtimeOverrideMinutes
  );

  return {
    ...derived,
    lateMinutes: lateOverride ?? derived.lateMinutes,
    overtimeMinutes: overtimeOverride ?? derived.overtimeMinutes,
    lateOverrideMinutes: lateOverride,
    overtimeOverrideMinutes: overtimeOverride,
  };
}

/**
 * Recompute and persist one record from its own stored timestamps.
 *
 * The repair path: called after any edit that changes times, and safe to call
 * repeatedly. Returns null when the record no longer exists.
 */
export async function recalculateAttendance(
  db: Db,
  attendanceId: string
): Promise<AttendanceRecord | null> {
  const row = await db.attendance.findUnique({
    where: { id: attendanceId },
    select: {
      id: true,
      workerId: true,
      branchId: true,
      date: true,
      checkIn: true,
      checkOut: true,
      breakStart: true,
      breakEnd: true,
      status: true,
    },
  });
  if (!row) return null;

  const context = await loadAttendanceContext(db, {
    workerId: row.workerId,
    branchId: row.branchId,
    date: row.date,
  });

  const fields = buildRecordFields(
    row.date,
    {
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      breakStart: row.breakStart,
      breakEnd: row.breakEnd,
    },
    context
  );

  return db.attendance.update({
    where: { id: attendanceId },
    data: fields,
    select: ATTENDANCE_SELECT,
  });
}

// ============================================================================
// WORKER ELIGIBILITY
//
// Constraints a date column cannot express. Checked on every authoring path so a
// manual entry cannot invent a day the employment relationship did not cover.
// ============================================================================

export type WorkerEligibility =
  | { ok: true; worker: { id: string; joinDate: Date; isActive: boolean } }
  | { ok: false; field: string; message: string };

/**
 * Can attendance be written for this worker on this date?
 *
 * Rejects a worker who does not exist, one who has been deactivated (the system's
 * soft delete — the row survives for payroll history, but must not accept NEW
 * days), and any date before they joined. Backdating a manual entry into the
 * month before someone was hired would otherwise quietly inflate their attendance
 * percentage and their payable days.
 */
export async function checkWorkerEligibility(
  db: Db,
  workerId: string,
  date: Date
): Promise<WorkerEligibility> {
  const worker = await db.workerProfile.findUnique({
    where: { id: workerId },
    select: { id: true, joinDate: true, isActive: true },
  });

  if (!worker) {
    return { ok: false, field: "workerId", message: "Worker not found" };
  }
  if (!worker.isActive) {
    return {
      ok: false,
      field: "workerId",
      message: "This employee is deactivated and cannot receive new attendance",
    };
  }

  // Compare on the date key alone: joinDate is a timestamp, and a worker who
  // joined at 14:00 still worked that calendar day.
  const joinKey = formatDateKey(
    new Date(Date.UTC(
      worker.joinDate.getUTCFullYear(),
      worker.joinDate.getUTCMonth(),
      worker.joinDate.getUTCDate()
    ))
  );

  if (formatDateKey(date) < joinKey) {
    return {
      ok: false,
      field: "date",
      message: `Attendance cannot predate the joining date (${joinKey})`,
    };
  }

  return { ok: true, worker };
}

// ============================================================================
// BRANCH RESOLUTION
// ============================================================================

/**
 * The branch a worker's attendance belongs to: their primary active posting,
 * falling back to any active posting.
 *
 * Mirrors the rule the original worker clock route used, kept so a worker's rows
 * keep landing in the same branch they always did.
 */
export async function resolveWorkerBranchId(
  db: Db,
  workerId: string,
  preferredBranchId?: string | null
): Promise<string | null> {
  if (preferredBranchId) {
    const link = await db.workerBranch.findFirst({
      where: { workerId, branchId: preferredBranchId, isActive: true },
      select: { branchId: true },
    });
    if (link) return link.branchId;
  }

  const primary = await db.workerBranch.findFirst({
    where: { workerId, isActive: true },
    orderBy: { isPrimary: "desc" },
    select: { branchId: true },
  });

  return primary?.branchId ?? null;
}

// ============================================================================
// "MARKED BY" RESOLUTION
// ============================================================================

export type MarkedByLabel = { id: string; name: string; role: string };

/**
 * Resolve User ids to display names for the "Marked By" column.
 *
 * User has no name column — a person's name lives on StaffProfile (admins,
 * receptionists) or WorkerProfile. One batched query covers a whole page rather
 * than a lookup per row.
 */
export async function resolveMarkedBy(
  db: Db,
  userIds: (string | null | undefined)[]
): Promise<Map<string, MarkedByLabel>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  const map = new Map<string, MarkedByLabel>();
  if (ids.length === 0) return map;

  const users = await db.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      email: true,
      phone: true,
      userType: true,
      staffProfile: { select: { firstName: true, lastName: true } },
      workerProfile: { select: { firstName: true, lastName: true, displayName: true } },
    },
  });

  for (const user of users) {
    const staff = user.staffProfile;
    const worker = user.workerProfile;
    const name =
      (staff ? `${staff.firstName} ${staff.lastName}`.trim() : "") ||
      (worker ? worker.displayName?.trim() || `${worker.firstName} ${worker.lastName}`.trim() : "") ||
      user.email ||
      user.phone ||
      "Unknown";

    map.set(user.id, { id: user.id, name, role: user.userType });
  }

  return map;
}

// ============================================================================
// FILTERS
// ============================================================================

const SORTABLE = new Set([
  "date",
  "checkIn",
  "checkOut",
  "workingMinutes",
  "lateMinutes",
  "overtimeMinutes",
  "status",
]);

/** How a row came to exist. "all" applies no filter at all. */
export const ENTRY_TYPES = ["all", "manual", "automatic"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export type AttendanceFilters = {
  from: Date | null;
  to: Date | null;
  workerId: string | null;
  shiftId: string | null;
  status: AttendanceStatus | null;
  lateOnly: boolean;
  overtimeOnly: boolean;
  entryType: EntryType;
  search: string | null;
  sortBy: string;
  sortOrder: Prisma.SortOrder;
};

function isStatus(value: string): value is AttendanceStatus {
  return (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

function isEntryType(value: string): value is EntryType {
  return (ENTRY_TYPES as readonly string[]).includes(value);
}

/**
 * Read every supported filter off the query string.
 *
 * `?date=` is sugar for a single-day range so the dashboard and the table can
 * share one contract. Branch is deliberately NOT read here — it comes from
 * `requireBranchScope()`, so a branch admin cannot widen their view with a param.
 */
export function parseAttendanceFilters(url: URL): AttendanceFilters {
  const params = url.searchParams;

  const single = params.get("date")?.trim();
  const singleDate = single ? parseDateKey(single) : null;

  const from = singleDate ?? parseDateKey(params.get("from")?.trim() ?? "");
  const to = singleDate ?? parseDateKey(params.get("to")?.trim() ?? "");

  const statusRaw = params.get("status")?.trim() ?? "";
  const sortByRaw = params.get("sortBy")?.trim() ?? "date";
  const entryTypeRaw = params.get("entryType")?.trim().toLowerCase() ?? "all";

  return {
    from,
    to,
    workerId: params.get("workerId")?.trim() || null,
    shiftId: params.get("shiftId")?.trim() || null,
    status: isStatus(statusRaw) ? statusRaw : null,
    lateOnly: params.get("late") === "true",
    overtimeOnly: params.get("overtime") === "true",
    entryType: isEntryType(entryTypeRaw) ? entryTypeRaw : "all",
    search: params.get("search")?.trim() || null,
    sortBy: SORTABLE.has(sortByRaw) ? sortByRaw : "date",
    sortOrder: params.get("sortOrder")?.toLowerCase() === "asc" ? "asc" : "desc",
  };
}

/**
 * Compose filters + branch scope into a Prisma where clause.
 *
 * Branch isolation comes from `branchWhere(scope)` and NOTHING else, so it cannot
 * be widened by a query param — a branch admin's scope is pinned to their JWT.
 */
export function buildAttendanceWhere(
  filters: AttendanceFilters,
  scope: BranchScope
): Prisma.AttendanceWhereInput {
  return {
    ...branchWhere(scope),
    ...(filters.workerId ? { workerId: filters.workerId } : {}),
    ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.lateOnly ? { lateMinutes: { gt: 0 } } : {}),
    ...(filters.overtimeOnly ? { overtimeMinutes: { gt: 0 } } : {}),
    ...(filters.entryType === "all" ? {} : { isManual: filters.entryType === "manual" }),
    ...(filters.from || filters.to
      ? {
          date: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
    ...(filters.search
      ? {
          worker: {
            OR: [
              { firstName: { contains: filters.search, mode: "insensitive" as const } },
              { lastName: { contains: filters.search, mode: "insensitive" as const } },
              { displayName: { contains: filters.search, mode: "insensitive" as const } },
              { employeeCode: { contains: filters.search, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };
}

/** Stable ordering — the secondary id key stops pagination duplicating rows. */
export function attendanceOrderBy(
  filters: AttendanceFilters
): Prisma.AttendanceOrderByWithRelationInput[] {
  return [{ [filters.sortBy]: filters.sortOrder }, { id: "asc" }];
}

// ============================================================================
// DATE RANGE HELPERS
// ============================================================================

/** Inclusive list of date keys spanning a range. Drives the calendar and reports. */
export function eachDateKey(from: Date, to: Date, maxDays = 400): Date[] {
  const out: Date[] = [];
  const cursor = new Date(from.getTime());

  while (cursor.getTime() <= to.getTime() && out.length < maxDays) {
    out.push(new Date(cursor.getTime()));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return out;
}

/** First and last date key of the month containing `date`. */
export function monthBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
  return { start, end };
}

/** Monday-anchored week containing `date`. */
export function weekBounds(date: Date): { start: Date; end: Date } {
  const day = localDayOfWeek(date);
  const backToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(date.getTime());
  start.setUTCDate(start.getUTCDate() - backToMonday);
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 6);
  return { start, end };
}

/** Today's date key, in salon-local time. Re-exported so routes need one import. */
export function today(): Date {
  return attendanceDateKey();
}
