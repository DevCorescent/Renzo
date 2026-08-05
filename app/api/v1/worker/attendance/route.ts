// ============================================================================
// MODULE : Worker Attendance
// ROUTE  : /api/v1/worker/attendance
//
// METHODS
//   GET  — The caller's own attendance log. Same envelope, params and ordering as
//          before (?from / ?to / ?page / ?limit, date desc); the rows now also
//          carry branch, shift and every derived metric.
//   POST — Clock the caller in or out, or start/end their break.
//          { action: "CHECK_IN" | "CHECK_OUT" | "BREAK_START" | "BREAK_END" }
//
// ACCESS: WORKER (self only — the worker id comes from the token, never the body).
//
// Both handlers delegate to lib/attendance-api.ts so that a worker clocking
// themselves in and a receptionist clocking them in run the SAME state machine and
// the SAME engine. That is what stops the two doors from disagreeing: illegal
// transitions now answer 409 ("Already checked in for today") instead of silently
// overwriting the earlier timestamp, working hours / late / overtime are derived
// from the assigned shift rather than left at zero, and every action is audited.
// ============================================================================

import { NextRequest } from "next/server";
import { listWorkerAttendance, workerClockAction } from "@/lib/attendance-api";

// OWNER: Aman | MODULE: Worker Attendance
export async function GET(req: NextRequest) {
  return listWorkerAttendance(req);
}

export async function POST(req: NextRequest) {
  return workerClockAction(req);
}
