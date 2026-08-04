// ============================================================================
// MODULE : Attendance Management (branch admin)
// ROUTE  : /api/v1/branch-admin/attendance
//
// METHODS
//   GET  — List attendance for the caller's own branch.
//   POST — Mark attendance (manual entry or clock action) for their own workers.
//
// ACCESS: BRANCH_ADMIN, plus SUPER_ADMIN / OWNER so a platform role investigating
//   a branch is not bounced off an endpoint their own admins use.
//
// A DOOR, NOT A DUPLICATE. This runs the identical handlers as
// /api/v1/admin/attendance. Branch isolation is NOT re-implemented here — it comes
// from requireBranchScope(), which pins a BRANCH_ADMIN to the branch on their JWT
// and ignores any ?branchId they send. Re-deriving it in a second copy is exactly
// how the two would eventually disagree.
//
// Editing, deleting, bulk marking, reports and exports are the shared admin
// endpoints (/api/v1/admin/attendance/…), which already admit BRANCH_ADMIN and
// scope them the same way.
// ============================================================================

import { NextRequest } from "next/server";
import { listAttendance, markAttendance } from "@/lib/attendance-api";
import type { UserType } from "@/types/api";

const ROLES: UserType[] = ["BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"];

export async function GET(req: NextRequest) {
  return listAttendance(req, ROLES);
}

export async function POST(req: NextRequest) {
  return markAttendance(req, ROLES);
}
