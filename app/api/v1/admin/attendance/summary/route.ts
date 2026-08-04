// ============================================================================
// MODULE : Attendance Management (admin)
// ROUTE  : /api/v1/admin/attendance/summary
//
// METHOD
//   GET — Headline counters for one date (?date=YYYY-MM-DD, default today):
//         present / absent / late / half-day / on-leave / holiday / week-off,
//         currently working, checked out, average working hours, average late
//         minutes, total hours — plus `activeWorkers` and `notMarked`.
//
// `notMarked` is the number the other counters cannot show: active workers in
// scope who have NO row at all. A dashboard built only from existing rows would
// report a flawless day for a branch where nobody had been marked yet.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN (branch-scoped), RECEPTIONIST — the
// front desk needs today's board to know who is still out.
// ============================================================================

import { NextRequest } from "next/server";
import { attendanceSummary } from "@/lib/attendance-api";
import type { UserType } from "@/types/api";

const ROLES: UserType[] = ["SUPER_ADMIN", "OWNER", "BRANCH_ADMIN", "RECEPTIONIST"];

export async function GET(req: NextRequest) {
  return attendanceSummary(req, ROLES);
}
