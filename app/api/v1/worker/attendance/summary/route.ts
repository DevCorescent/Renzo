// ============================================================================
// MODULE : Worker Attendance
// ROUTE  : /api/v1/worker/attendance/summary
//
// METHOD
//   GET — The caller's own month: attendance %, total hours, overtime, late days,
//         break time, per-status counts, plus today's record.
//         ?month=YYYY-MM (defaults to the current month).
//
// ACCESS: WORKER (self only).
//
// Totals are produced by the same `summarizeAttendance()` the admin dashboard and
// the exports use, so a worker checking their own hours sees exactly the number
// their manager sees.
// ============================================================================

import { NextRequest } from "next/server";
import { workerAttendanceSummary } from "@/lib/attendance-api";

export async function GET(req: NextRequest) {
  return workerAttendanceSummary(req);
}
