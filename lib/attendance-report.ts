// ============================================================================
// MODULE : Attendance — reporting
//
// Every report the product offers is the same query bucketed a different way.
//
//   Daily / Weekly / Monthly / Yearly  → groupBy=daily|weekly|monthly|yearly
//   Per Worker / Per Branch / Per Shift → groupBy=worker|branch|shift
//   Late / Overtime / Absent / Leave    → the ?late, ?overtime and ?status
//                                          filters the list endpoint already reads
//
// Totals come from `summarizeAttendance()` — the SAME function the dashboard
// cards and the worker's own page use — so a downloaded report can never
// contradict the screen it was downloaded from.
// ============================================================================

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import type { BranchScope } from "@/lib/branch-scope";
import {
  formatDateKey,
  summarizeAttendance,
  type AttendanceSummary,
} from "@/lib/attendance";
import {
  attendanceOrderBy,
  buildAttendanceWhere,
  weekBounds,
  type AttendanceFilters,
} from "@/lib/attendance-service";

export const REPORT_GROUPS = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "worker",
  "branch",
  "shift",
] as const;

export type ReportGroup = (typeof REPORT_GROUPS)[number];

export function isReportGroup(value: string): value is ReportGroup {
  return (REPORT_GROUPS as readonly string[]).includes(value);
}

/**
 * Upper bound on rows pulled into memory for one report.
 *
 * A year across a large chain is tens of thousands of rows; aggregating them here
 * rather than in SQL is a deliberate trade of a little memory for ONE definition
 * of every total. The cap stops a pathological range from exhausting the process,
 * and `truncated` tells the caller it happened instead of silently under-reporting.
 */
const MAX_REPORT_ROWS = 50_000;

const REPORT_SELECT = {
  date: true,
  status: true,
  workingMinutes: true,
  overtimeMinutes: true,
  lateMinutes: true,
  breakMinutes: true,
  checkIn: true,
  checkOut: true,
  branch: { select: { id: true, name: true, code: true } },
  shift: { select: { id: true, name: true } },
  worker: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      employeeCode: true,
    },
  },
} satisfies Prisma.AttendanceSelect;

type ReportSourceRow = Prisma.AttendanceGetPayload<{ select: typeof REPORT_SELECT }>;

export type ReportRow = AttendanceSummary & {
  key: string;
  label: string;
  sublabel: string | null;
};

export type AttendanceReport = {
  groupBy: ReportGroup;
  rows: ReportRow[];
  totals: AttendanceSummary;
  rowCount: number;
  truncated: boolean;
};

function workerName(worker: ReportSourceRow["worker"]): string {
  return worker.displayName?.trim() || `${worker.firstName} ${worker.lastName}`.trim();
}

/** Bucket identity + how to label it. One switch, so a new grouping is one case. */
function bucketOf(row: ReportSourceRow, groupBy: ReportGroup): {
  key: string;
  label: string;
  sublabel: string | null;
} {
  switch (groupBy) {
    case "daily": {
      const key = formatDateKey(row.date);
      return { key, label: key, sublabel: null };
    }
    case "weekly": {
      const { start, end } = weekBounds(row.date);
      return {
        key: formatDateKey(start),
        label: `Week of ${formatDateKey(start)}`,
        sublabel: `${formatDateKey(start)} → ${formatDateKey(end)}`,
      };
    }
    case "monthly": {
      const key = formatDateKey(row.date).slice(0, 7);
      return { key, label: key, sublabel: null };
    }
    case "yearly": {
      const key = formatDateKey(row.date).slice(0, 4);
      return { key, label: key, sublabel: null };
    }
    case "worker":
      return {
        key: row.worker.id,
        label: workerName(row.worker),
        sublabel: row.worker.employeeCode,
      };
    case "branch":
      return { key: row.branch.id, label: row.branch.name, sublabel: row.branch.code };
    case "shift":
      return {
        key: row.shift?.id ?? "__none__",
        label: row.shift?.name ?? "No shift assigned",
        sublabel: null,
      };
  }
}

/**
 * Build a grouped attendance report.
 *
 * Buckets are ordered by key — chronological for the time groupings (ISO keys sort
 * correctly as strings) and alphabetical by label for the entity groupings.
 */
export async function buildAttendanceReport(
  scope: BranchScope,
  filters: AttendanceFilters,
  groupBy: ReportGroup
): Promise<AttendanceReport> {
  const where = buildAttendanceWhere(filters, scope);

  const rows = await prisma.attendance.findMany({
    where,
    orderBy: attendanceOrderBy(filters),
    take: MAX_REPORT_ROWS + 1,
    select: REPORT_SELECT,
  });

  const truncated = rows.length > MAX_REPORT_ROWS;
  const source = truncated ? rows.slice(0, MAX_REPORT_ROWS) : rows;

  const buckets = new Map<
    string,
    { label: string; sublabel: string | null; rows: ReportSourceRow[] }
  >();

  for (const row of source) {
    const bucket = bucketOf(row, groupBy);
    const existing = buckets.get(bucket.key);
    if (existing) existing.rows.push(row);
    else buckets.set(bucket.key, { label: bucket.label, sublabel: bucket.sublabel, rows: [row] });
  }

  const isTimeGrouping = ["daily", "weekly", "monthly", "yearly"].includes(groupBy);

  const reportRows: ReportRow[] = [...buckets.entries()]
    .map(([key, bucket]) => ({
      key,
      label: bucket.label,
      sublabel: bucket.sublabel,
      ...summarizeAttendance(bucket.rows),
    }))
    .sort((a, b) =>
      isTimeGrouping ? a.key.localeCompare(b.key) : a.label.localeCompare(b.label)
    );

  return {
    groupBy,
    rows: reportRows,
    totals: summarizeAttendance(source),
    rowCount: source.length,
    truncated,
  };
}
