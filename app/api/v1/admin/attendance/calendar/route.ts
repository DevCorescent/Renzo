// ============================================================================
// MODULE : Attendance Management (admin)
// ROUTE  : /api/v1/admin/attendance/calendar
//
// METHOD
//   GET — One month of attendance shaped for a calendar grid.
//         ?month=YYYY-MM (default current month), plus the usual filters.
//
//   Two shapes, chosen by whether a worker is named:
//     ?workerId=…  → PER-DAY RECORD. One status per cell — the individual's
//                    month, which is what "attendance calendar" means for a person.
//     (no worker)  → PER-DAY TOTALS. Status counts per cell, so a branch's month
//                    reads as a heat map instead of collapsing to one colour.
//
// Every day in the month is emitted, including days with no rows, so the frontend
// renders a complete grid without inventing the gaps itself.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN (branch-scoped).
// ============================================================================

import { NextRequest } from "next/server";
import type { AttendanceStatus } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import prisma from "@/lib/db";
import {
  ATTENDANCE_STATUSES,
  attendanceDateKey,
  formatDateKey,
  formatLocalTime,
  parseDateKey,
  summarizeAttendance,
} from "@/lib/attendance";
import {
  buildAttendanceWhere,
  eachDateKey,
  monthBounds,
  parseAttendanceFilters,
} from "@/lib/attendance-service";

type StatusCounts = Record<AttendanceStatus, number>;

function emptyCounts(): StatusCounts {
  return Object.fromEntries(ATTENDANCE_STATUSES.map((s) => [s, 0])) as StatusCounts;
}

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const url = new URL(req.url);
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  try {
    // ?month=YYYY-MM is the calendar's own contract; the shared date filters still
    // apply for everything else.
    const monthRaw = url.searchParams.get("month")?.trim();
    let anchor = attendanceDateKey();

    if (monthRaw) {
      if (!/^\d{4}-\d{2}$/.test(monthRaw)) {
        return err("Validation failed", 422, { month: ["Must be YYYY-MM"] });
      }
      const parsedMonth = parseDateKey(`${monthRaw}-01`);
      if (!parsedMonth) return err("Validation failed", 422, { month: ["Invalid month"] });
      anchor = parsedMonth;
    }

    const { start, end } = monthBounds(anchor);
    const filters = { ...parseAttendanceFilters(url), from: start, to: end };
    const where = buildAttendanceWhere(filters, scope);

    const records = await prisma.attendance.findMany({
      where,
      orderBy: [{ date: "asc" }],
      select: {
        id: true,
        date: true,
        status: true,
        checkIn: true,
        checkOut: true,
        workingMinutes: true,
        lateMinutes: true,
        overtimeMinutes: true,
        breakMinutes: true,
        worker: { select: { id: true, firstName: true, lastName: true, displayName: true } },
      },
    });

    const perDay = new Map<string, typeof records>();
    for (const record of records) {
      const key = formatDateKey(record.date);
      const bucket = perDay.get(key);
      if (bucket) bucket.push(record);
      else perDay.set(key, [record]);
    }

    const isSingleWorker = Boolean(filters.workerId);

    const days = eachDateKey(start, end).map((date) => {
      const key = formatDateKey(date);
      const rows = perDay.get(key) ?? [];

      if (isSingleWorker) {
        const row = rows[0] ?? null;
        return {
          date: key,
          dayOfWeek: date.getUTCDay(),
          status: row?.status ?? null,
          record: row
            ? {
                id: row.id,
                checkIn: formatLocalTime(row.checkIn),
                checkOut: formatLocalTime(row.checkOut),
                workingMinutes: row.workingMinutes,
                lateMinutes: row.lateMinutes,
                overtimeMinutes: row.overtimeMinutes,
                breakMinutes: row.breakMinutes,
              }
            : null,
          counts: null,
          total: rows.length,
        };
      }

      const counts = emptyCounts();
      for (const row of rows) counts[row.status] += 1;

      return {
        date: key,
        dayOfWeek: date.getUTCDay(),
        status: null,
        record: null,
        counts,
        total: rows.length,
      };
    });

    return ok({
      month: formatDateKey(start).slice(0, 7),
      range: { from: formatDateKey(start), to: formatDateKey(end) },
      mode: isSingleWorker ? "worker" : "branch",
      days,
      summary: summarizeAttendance(records),
    });
  } catch {
    return err("Internal server error", 500);
  }
}
