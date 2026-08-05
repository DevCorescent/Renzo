// ============================================================================
// MODULE : Attendance — shared frontend contracts
//
// Exactly the shapes the API returns. Nothing here is invented: every field
// corresponds to one in ATTENDANCE_SELECT (lib/attendance-service.ts) or to a key
// the summary / report / calendar routes build. If a field is absent from the
// server's select, it is absent here, and the UI cannot render it.
//
// Dates cross the wire as ISO strings — Prisma `Date`s are JSON-serialised by the
// route — so every timestamp is typed `string`, not `Date`.
// ============================================================================

// The status list and its formatters are RE-EXPORTED from the engine rather than
// mirrored here. A second copy would be a second thing to remember when the Prisma
// enum changes, and the filter dropdown, the calendar legend and the mark dialog
// would drift from what the API accepts. lib/attendance.ts is pure — its only
// @prisma/client import is type-only — so it is safe in a client bundle.
import {
  ATTENDANCE_STATUSES,
  SALON_TIME_ZONE,
  formatMinutes,
  statusLabel,
  type AttendanceStatus,
} from "@/lib/attendance";

export {
  ATTENDANCE_STATUSES,
  SALON_TIME_ZONE,
  formatMinutes,
  statusLabel,
  type AttendanceStatus,
};

export type AttendanceWorker = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  employeeCode: string;
  profilePhoto: string | null;
  designation: { name: string } | null;
};

export type AttendanceShift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
};

export type AttendanceRow = {
  id: string;
  date: string;
  status: AttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  workingMinutes: number;
  breakMinutes: number;
  lateMinutes: number;
  earlyArrivalMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  overtimeApproved: boolean;
  isLocked: boolean;
  /** True when a person authored this row rather than a clock action. */
  isManual: boolean;
  manualReason: string | null;
  manualCreatedBy: string | null;
  manualCreatedAt: string | null;
  manualCreatedByName: string | null;
  /** Null while a manual entry is still pending approval. */
  approvedBy: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  /** Non-null when a supervisor corrected the engine's figure. */
  lateOverrideMinutes: number | null;
  overtimeOverrideMinutes: number | null;
  notes: string | null;
  markedBy: string | null;
  createdAt: string;
  updatedAt: string;
  branch: { id: string; name: string; code: string };
  shift: AttendanceShift | null;
  worker: AttendanceWorker;
  markedByName: string | null;
};

/** GET /api/v1/admin/attendance/summary */
export type AttendanceSummary = {
  date: string;
  total: number;
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  onLeave: number;
  holiday: number;
  weekOff: number;
  countableDays: number;
  creditedDays: number;
  attendancePct: number | null;
  workingMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  breakMinutes: number;
  workingHours: number;
  overtimeHours: number;
  avgWorkingMinutes: number;
  avgLateMinutes: number;
  checkedIn: number;
  checkedOut: number;
  activeWorkers: number;
  notMarked: number;
  working: number;
};

export const EMPTY_SUMMARY: AttendanceSummary = {
  date: "",
  total: 0, present: 0, late: 0, halfDay: 0, absent: 0, onLeave: 0, holiday: 0, weekOff: 0,
  countableDays: 0, creditedDays: 0, attendancePct: null,
  workingMinutes: 0, overtimeMinutes: 0, lateMinutes: 0, breakMinutes: 0,
  workingHours: 0, overtimeHours: 0, avgWorkingMinutes: 0, avgLateMinutes: 0,
  checkedIn: 0, checkedOut: 0, activeWorkers: 0, notMarked: 0, working: 0,
};

/** GET /api/v1/admin/attendance/report */
export type ReportGroup =
  | "daily" | "weekly" | "monthly" | "yearly" | "worker" | "branch" | "shift";

export type ReportRow = Omit<AttendanceSummary,
  "date" | "activeWorkers" | "notMarked" | "working"
> & {
  key: string;
  label: string;
  sublabel: string | null;
};

export type AttendanceReport = {
  groupBy: ReportGroup;
  rows: ReportRow[];
  totals: Omit<AttendanceSummary, "date" | "activeWorkers" | "notMarked" | "working">;
  rowCount: number;
  truncated: boolean;
  range: { from: string; to: string };
};

/** GET /api/v1/admin/attendance/calendar */
export type CalendarDay = {
  date: string;
  dayOfWeek: number;
  status: AttendanceStatus | null;
  record: {
    id: string;
    checkIn: string;
    checkOut: string;
    workingMinutes: number;
    lateMinutes: number;
    overtimeMinutes: number;
    breakMinutes: number;
  } | null;
  counts: Record<AttendanceStatus, number> | null;
  total: number;
};

export type AttendanceCalendar = {
  month: string;
  range: { from: string; to: string };
  mode: "worker" | "branch";
  days: CalendarDay[];
  summary: Omit<AttendanceSummary, "date" | "activeWorkers" | "notMarked" | "working">;
};

/** GET /api/v1/admin/shifts */
export type ShiftRow = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakStart: string | null;
  breakEnd: string | null;
  workingDays: number[];
  graceMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { workerShifts: number; attendances: number };
};

/** Filter dropdown options, read server-side for the toolbar. */
export type BranchOption = { id: string; name: string };
export type WorkerOption = { id: string; name: string; employeeCode: string };
export type ShiftOption = { id: string; name: string };

// ============================================================================
// FORMATTING
//
// These take the ISO strings that cross the wire; their engine counterparts take
// `Date`s straight from Prisma. Both render in SALON_TIME_ZONE, imported above, so
// a check-in never displays in a different zone from the late-minutes beside it.
// ============================================================================

/** ISO instant → "09:32" in salon-local time. */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SALON_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d);
}

/** "2026-08-03" → "03 Aug 2026". */
export function formatDate(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** "2026-08-03" → "Mon". */
export function formatWeekday(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short" }).format(d);
}

/** `formatMinutes`, but renders zero as an em dash where "0h 0m" is table noise. */
export function formatMinutesOrDash(minutes: number): string {
  return minutes > 0 ? formatMinutes(minutes) : "—";
}

export function workerName(worker: AttendanceWorker): string {
  return worker.displayName?.trim() || `${worker.firstName} ${worker.lastName}`.trim();
}

/** Today's date key in salon-local time — the default for every date input. */
export function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SALON_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Current month key, "YYYY-MM". */
export function currentMonthKey(): string {
  return todayKey().slice(0, 7);
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** [1,2,3,4,5] → "Mon–Fri"; non-contiguous sets list individually. */
export function formatWorkingDays(days: number[]): string {
  if (days.length === 0) return "—";
  if (days.length === 7) return "Every day";

  const sorted = [...days].sort((a, b) => a - b);
  const isContiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);

  if (isContiguous && sorted.length > 2) {
    return `${WEEKDAY_LABELS[sorted[0]]}–${WEEKDAY_LABELS[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((d) => WEEKDAY_LABELS[d]).join(", ");
}
