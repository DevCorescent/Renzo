// ============================================================================
// MODULE : Attendance — shared presentational atoms
//
// No "use client": these are pure render helpers with no state or effects, so
// they work inside Server Components (the pages) AND inside the client dialogs
// and tables. One status colour table, used by the badge, the calendar and the
// legend, so a green cell always means the same thing as a green pill.
// ============================================================================

import * as React from "react";
import { Badge } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import {
  statusLabel,
  type AttendanceStatus,
  ATTENDANCE_STATUSES,
} from "@/components/attendance/types";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

/** Badge tone per status. The single mapping the whole module reads. */
export const STATUS_TONE: Record<AttendanceStatus, Tone> = {
  PRESENT: "success",
  LATE: "warning",
  HALF_DAY: "info",
  ABSENT: "danger",
  ON_LEAVE: "neutral",
  HOLIDAY: "primary",
  WEEK_OFF: "neutral",
};

/**
 * Solid fills for calendar cells and legend swatches.
 *
 * Deliberately not the Badge tones: a calendar needs an opaque block that reads at
 * a glance, and the two live side by side in the legend. Each pair carries a dark
 * variant so the grid stays legible inside the dashboard's dark theme root.
 */
export const STATUS_FILL: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-500 text-white dark:bg-emerald-500/80",
  LATE: "bg-amber-500 text-white dark:bg-amber-500/80",
  HALF_DAY: "bg-sky-500 text-white dark:bg-sky-500/80",
  ABSENT: "bg-red-500 text-white dark:bg-red-500/80",
  ON_LEAVE: "bg-violet-500 text-white dark:bg-violet-500/80",
  HOLIDAY: "bg-gray-800 text-white dark:bg-white/70 dark:text-gray-900",
  WEEK_OFF: "bg-gray-300 text-gray-700 dark:bg-white/20 dark:text-(--sa-text-2)",
};

export function AttendanceStatusBadge({
  status,
  className,
}: {
  status: AttendanceStatus;
  className?: string;
}) {
  return (
    <Badge tone={STATUS_TONE[status]} className={className}>
      {statusLabel(status)}
    </Badge>
  );
}

/**
 * Manual vs Automatic provenance.
 *
 * Deliberately quiet for the automatic case: most rows are automatic, and a table
 * where every line shouts is a table nobody reads. The manual pill is the
 * exception that should catch the eye.
 */
export function EntryTypeBadge({
  isManual,
  className,
}: {
  isManual: boolean;
  className?: string;
}) {
  return (
    <Badge tone={isManual ? "warning" : "neutral"} className={className}>
      {isManual ? "Manual" : "Automatic"}
    </Badge>
  );
}

/**
 * Approval state of a MANUAL entry. Renders nothing for an automatic row, which
 * was never pending anything — an "N/A" pill on every clocked row would be noise.
 */
export function ApprovalBadge({
  isManual,
  approvedAt,
  approvedByName,
  className,
}: {
  isManual: boolean;
  approvedAt: string | null;
  approvedByName?: string | null;
  className?: string;
}) {
  if (!isManual) return <span className="text-gray-300 dark:text-(--sa-text-2)">—</span>;

  return approvedAt ? (
    // The approver's name rides on a wrapper title rather than the Badge, which
    // takes no arbitrary DOM props.
    <span title={approvedByName ? `Approved by ${approvedByName}` : undefined}>
      <Badge tone="success" className={className}>
        Approved
      </Badge>
    </span>
  ) : (
    <Badge tone="warning" className={className}>
      Pending
    </Badge>
  );
}

/** Colour key for the calendar. Rendered once, above the grid. */
export function StatusLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      {ATTENDANCE_STATUSES.map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-(--sa-text-2)">
          <span className={cn("size-3 rounded-sm", STATUS_FILL[status])} aria-hidden="true" />
          {statusLabel(status)}
        </span>
      ))}
    </div>
  );
}

/** Consistent empty state for every attendance surface. */
export function AttendanceEmpty({
  title,
  hint,
  icon: Icon,
}: {
  title: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      {Icon && <Icon className="size-7 text-gray-300 dark:text-(--sa-muted)" />}
      <p className="text-sm font-medium text-gray-600 dark:text-(--sa-text)">{title}</p>
      {hint && <p className="max-w-sm text-xs text-gray-400 dark:text-(--sa-muted)">{hint}</p>}
    </div>
  );
}

/** Inline error panel, matching the leaves module's failure surface. */
export function AttendanceError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
    >
      {message}
    </div>
  );
}

/** Translate an ApiResult failure into something a human can act on. */
export function friendlyError(status: number, message: string): string {
  switch (status) {
    case 401: return "Your session has expired. Please sign in again.";
    case 403: return "You do not have access to attendance records.";
    case 0: return "Could not reach the server. Check your connection and try again.";
    case 500: return "Something went wrong on our end. Please try again shortly.";
    default: return message || "Could not load attendance.";
  }
}
