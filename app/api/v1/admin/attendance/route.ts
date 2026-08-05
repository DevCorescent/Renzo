// ============================================================================
// MODULE : Attendance Management (admin)
// ROUTE  : /api/v1/admin/attendance
//
// METHODS
//   GET  — List attendance. Paginated, sorted, searched, filtered by date range,
//          worker, shift, status, late-only and overtime-only. Branch-scoped.
//   POST — Mark attendance. Accepts either a manual entry
//          ({ workerId, date, status, checkIn, checkOut, … }) or a clock action
//          ({ workerId, action: "CHECK_IN" | "CHECK_OUT" | "BREAK_START" | "BREAK_END" }).
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN.
//   A SUPER_ADMIN / OWNER sees every branch and may narrow with ?branchId.
//   A BRANCH_ADMIN is pinned to their own branch by requireBranchScope() and a
//   client-supplied ?branchId is ignored, not honoured.
//
// The handlers live in lib/attendance-api.ts because the branch-admin and
// reception doors run the SAME code with different roles — see that file's header.
// ============================================================================

import { NextRequest } from "next/server";
import { listAttendance, markAttendance } from "@/lib/attendance-api";
import type { UserType } from "@/types/api";

const ROLES: UserType[] = ["SUPER_ADMIN", "OWNER", "BRANCH_ADMIN"];

export async function GET(req: NextRequest) {
  return listAttendance(req, ROLES);
}

export async function POST(req: NextRequest) {
  return markAttendance(req, ROLES);
}
