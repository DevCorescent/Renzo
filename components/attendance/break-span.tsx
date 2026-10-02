// ============================================================================
// MODULE : Attendance — one lunch break, rendered the same everywhere
//
// "13:05 – 13:40 · 35m", red with "+5m over" once it passes the 30-minute
// allowance (BREAK_ALLOWANCE_MINUTES). An open break runs to `now`, so a worker
// who has not come back shows as over while it is happening, not only after.
//
// No "use client": pure render, so the worker page (server) and the admin
// views (client) share it.
// ============================================================================

import {
  BREAK_ALLOWANCE_MINUTES,
  breakDurationMinutes,
  breakOverMinutes,
  formatLocalTime,
} from "@/lib/attendance";
import { cn } from "@/lib/utils";

export function BreakSpan({
  breakStart,
  breakEnd,
  now,
  className,
}: {
  breakStart: Date | string | null | undefined;
  breakEnd: Date | string | null | undefined;
  /** "Now" for an open break; defaults to the render time. */
  now?: Date;
  className?: string;
}) {
  const minutes = breakDurationMinutes(breakStart, breakEnd, now);
  if (minutes == null || !breakStart) {
    return <span className={cn("text-gray-400", className)}>—</span>;
  }

  const over = breakOverMinutes(minutes);
  const open = !breakEnd;

  return (
    <span
      className={cn(over > 0 ? "font-medium text-red-600 dark:text-red-400" : "text-gray-600 dark:text-(--sa-text-2)", className)}
      title={`Allowed: ${BREAK_ALLOWANCE_MINUTES} minutes`}
    >
      {formatLocalTime(new Date(breakStart))} – {open ? "…" : formatLocalTime(new Date(breakEnd!))}
      {" · "}
      {minutes}m{open ? " so far" : ""}
      {over > 0 && <span className="ml-1 whitespace-nowrap">(+{over}m over)</span>}
    </span>
  );
}
