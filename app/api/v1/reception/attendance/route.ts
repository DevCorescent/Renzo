// ============================================================================
// MODULE : Attendance (reception)
// ROUTE  : /api/v1/reception/attendance
//
// METHODS
//   GET  — Today's board for the caller's branch: who is in, out, late, on break.
//   POST — Clock a worker in or out, start or end their break, or mark them
//          present/absent for TODAY.
//
// ACCESS: RECEPTIONIST, plus BRANCH_ADMIN / SUPER_ADMIN / OWNER (same admission
//   list the existing reception endpoints use, so a manager covering the desk is
//   not locked out of it).
//
// WHAT RECEPTION CANNOT DO — enforced by capabilitiesFor() in lib/attendance-api.ts,
// on the server, not by hiding buttons:
//   • DELETE       — no handler is exported here at all, and canDelete is false.
//   • EDIT HISTORY — canEdit is false, so a POST that would overwrite an existing
//                    record answers 409 instead of silently rewriting it.
//   • BACKDATE     — canBackdate is false; a date other than today answers 403.
//   • OTHER BRANCHES — requireBranchScope() pins them to their own branch and
//                    ignores any ?branchId they send.
//   • PAYROLL      — no overtime approval, no locking, no payroll surface.
// ============================================================================

import { NextRequest } from "next/server";
import { listAttendance, markAttendance } from "@/lib/attendance-api";
import type { UserType } from "@/types/api";

const ROLES: UserType[] = ["RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"];

export async function GET(req: NextRequest) {
  return listAttendance(req, ROLES);
}

export async function POST(req: NextRequest) {
  return markAttendance(req, ROLES);
}
