// ============================================================================
// MODULE : Attendance Management (admin)
// ROUTE  : /api/v1/admin/attendance/bulk
//
// METHOD
//   POST — Mark many workers for one date in a single transaction.
//
//   Body: {
//     date?: "YYYY-MM-DD",              // defaults to today
//     status?: AttendanceStatus,        // default applied to every entry
//     notes?: string,
//     entries: [{ workerId, status?, checkIn?, checkOut?, notes? }]   // 1–200
//   }
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN. Reception is excluded by
//   capabilitiesFor() — bulk marking is a roster decision, not a front-desk one.
//
// Locked (payroll-signed) rows are SKIPPED rather than failing the batch, and the
// response names them, so one frozen record cannot block marking a whole branch.
// ============================================================================

import { NextRequest } from "next/server";
import { bulkAttendance } from "@/lib/attendance-api";
import type { UserType } from "@/types/api";

const ROLES: UserType[] = ["SUPER_ADMIN", "OWNER", "BRANCH_ADMIN"];

export async function POST(req: NextRequest) {
  return bulkAttendance(req, ROLES);
}
