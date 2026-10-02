"use client";

// OWNER: Hemant | MODULE: Worker Attendance — clock in / out, lunch break
// POST /api/v1/worker/attendance with { action: "CHECK_IN" | "CHECK_OUT" | "BREAK_START" | "BREAK_END" }
//
// One lunch break a day, 30 minutes allowed. The server owns the rules (no break
// before clocking in, none after clocking out, one per day, no clock-out while
// on break); these buttons only offer what is valid next and show the break
// time running, red once it passes the allowance.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BREAK_ALLOWANCE_MINUTES,
  breakDurationMinutes,
  breakOverMinutes,
  formatLocalTime,
} from "@/lib/attendance";

type ApiEnvelope = {
  success: boolean;
  message?: string;
};

type ClockAction = "CHECK_IN" | "CHECK_OUT" | "BREAK_START" | "BREAK_END";

const LABELS: Record<ClockAction, { idle: string; busy: string; done: string; failed: string }> = {
  CHECK_IN: { idle: "Clock in", busy: "Clocking in…", done: "Clocked in", failed: "clock in" },
  CHECK_OUT: { idle: "Clock out", busy: "Clocking out…", done: "Clocked out", failed: "clock out" },
  BREAK_START: { idle: "Start lunch break", busy: "Starting…", done: "Lunch break started", failed: "start the break" },
  BREAK_END: { idle: "End lunch break", busy: "Ending…", done: "Welcome back — lunch break ended", failed: "end the break" },
};

const btnPrimary =
  "inline-flex h-9 items-center rounded bg-gray-900 px-4 text-sm font-medium text-white " +
  "transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";
const btnSecondary =
  "inline-flex h-9 items-center rounded border border-gray-300 bg-white px-4 text-sm font-medium text-gray-800 " +
  "transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Re-render every 30 s while a break is open, so its minutes keep counting. The
 * first tick is immediate, so a break started after the page loaded does not
 * count from the (older) load time.
 */
function useNow(active: boolean): Date {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    if (!active) return;
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 30_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [active]);
  return now;
}

export function ClockActions({
  checkedIn,
  checkedOut,
  breakStart = null,
  breakEnd = null,
}: {
  checkedIn: boolean;
  checkedOut: boolean;
  /** Today's lunch break (ISO), or an unfinished one carried over from yesterday. */
  breakStart?: string | null;
  breakEnd?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<ClockAction | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const onBreak = Boolean(breakStart) && !breakEnd;
  const breakTaken = Boolean(breakStart) && Boolean(breakEnd);
  const now = useNow(onBreak);
  const breakMinutes = breakDurationMinutes(breakStart, breakEnd, now);
  const over = breakOverMinutes(breakMinutes);

  const canClockIn = !checkedIn;
  const canStartBreak = checkedIn && !checkedOut && !breakStart;
  // The server refuses a clock-out during a break; don't offer it.
  const canClockOut = checkedIn && !checkedOut && !onBreak;

  async function postAction(action: ClockAction) {
    if (busy) return;
    setError(null);
    setBusy(action);
    try {
      const res = await fetch("/api/v1/worker/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = (await res.json().catch(() => ({ success: false }))) as ApiEnvelope;
      if (!res.ok || !body.success) {
        setError(body.message || `Could not ${LABELS[action].failed}`);
        return;
      }
      setToast(LABELS[action].done);
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const button = (action: ClockAction, cls = btnPrimary) => (
    <button
      type="button"
      disabled={busy !== null}
      onClick={() => void postAction(action)}
      className={cls}
    >
      {busy === action ? LABELS[action].busy : LABELS[action].idle}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canClockIn && button("CHECK_IN")}
        {onBreak && button("BREAK_END")}
        {canStartBreak && button("BREAK_START", btnSecondary)}
        {canClockOut && button("CHECK_OUT")}
        {checkedIn && !checkedOut && !onBreak && (
          <span className="text-sm text-gray-500">You are clocked in.</span>
        )}
        {checkedIn && checkedOut && (
          <span className="text-sm text-gray-500">You are clocked out for today.</span>
        )}
      </div>

      {breakStart && breakMinutes != null && (
        <p
          role="status"
          className={
            over > 0
              ? "rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
              : "rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
          }
        >
          {onBreak
            ? `On lunch break since ${formatLocalTime(new Date(breakStart))} · ${breakMinutes} min`
            : `Lunch break ${formatLocalTime(new Date(breakStart))} – ${formatLocalTime(new Date(breakEnd!))} · ${breakMinutes} min`}
          {over > 0
            ? ` — ${over} min over the ${BREAK_ALLOWANCE_MINUTES}-minute limit`
            : onBreak
              ? ` of ${BREAK_ALLOWANCE_MINUTES}`
              : ""}
          {onBreak && " · End it before clocking out."}
          {breakTaken && " · One lunch break per day."}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      {toast && (
        <p className="rounded border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700">
          {toast}
        </p>
      )}
    </div>
  );
}
