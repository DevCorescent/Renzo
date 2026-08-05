// ============================================================================
// MODULE : Attendance Management (admin)
// ROUTE  : /api/v1/admin/attendance/[id]
//
// METHODS
//   GET    — Full detail for one record.
//   PATCH  — Edit times / status / notes, approve overtime, lock for payroll.
//            Every metric is RECOMPUTED from the resulting timestamps, so an
//            edited check-out immediately corrects working hours and overtime.
//   DELETE — Remove a record.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN — further narrowed per action by
//   capabilitiesFor() in lib/attendance-api.ts:
//     • overtime approval and payroll locking are SUPER_ADMIN / OWNER only
//     • a locked record is immutable for everyone else, including delete
//     • an out-of-branch record answers 404, never 403 (no existence oracle)
// ============================================================================

import { NextRequest } from "next/server";
import {
  deleteAttendance,
  getAttendance,
  patchAttendance,
} from "@/lib/attendance-api";
import type { UserType } from "@/types/api";

const ROLES: UserType[] = ["SUPER_ADMIN", "OWNER", "BRANCH_ADMIN"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return getAttendance(req, id, ROLES);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return patchAttendance(req, id, ROLES);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return deleteAttendance(req, id, ROLES);
}
