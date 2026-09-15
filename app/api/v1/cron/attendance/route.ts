// ============================================================================
// MODULE : Attendance — scheduled auto clock-out
// ROUTE  : /api/v1/cron/attendance
//
// METHODS
//   GET / POST — Close every attendance record still open 30 minutes after its
//                shift ended (see autoClockOut() in lib/attendance-api.ts).
//                GET is what Vercel Cron sends; POST is for any other scheduler
//                (GitHub Actions, cron-job.org, a server crontab).
//
// ACCESS: machine-only. `Authorization: Bearer <CRON_SECRET>`. With CRON_SECRET
//   unset the endpoint refuses every call rather than running unauthenticated.
//
// Safe to call as often as you like — a closed record is never touched twice.
// ============================================================================

import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { ok, err } from "@/lib/response";
import { autoClockOut, AUTO_CLOCK_OUT_BUFFER_MINUTES } from "@/lib/attendance-api";

function isAuthorized(req: NextRequest, secret: string): boolean {
  const sent = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return sent.length === expected.length && timingSafeEqual(sent, expected);
}

async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return err("CRON_SECRET is not configured", 503);
  if (!isAuthorized(req, secret)) return err("Unauthorized", 401);

  // `?now=<ISO>` replays a later moment so the flow can be tested without waiting
  // for a shift to end. Development only — production always uses the real clock.
  let now = new Date();
  const nowParam = new URL(req.url).searchParams.get("now");
  if (nowParam && process.env.NODE_ENV !== "production") {
    const parsed = new Date(nowParam);
    if (Number.isNaN(parsed.getTime())) return err("Invalid `now` timestamp", 422);
    now = parsed;
  }

  try {
    const result = await autoClockOut(now);
    return ok(
      { ranAt: now.toISOString(), bufferMinutes: AUTO_CLOCK_OUT_BUFFER_MINUTES, ...result },
      `Auto clock-out: ${result.closed.length} closed, ${result.skipped.length} skipped`
    );
  } catch (e) {
    console.error("Auto clock-out failed:", e);
    return err("Internal server error", 500);
  }
}

export async function GET(req: NextRequest) {
  return run(req);
}

export async function POST(req: NextRequest) {
  return run(req);
}
