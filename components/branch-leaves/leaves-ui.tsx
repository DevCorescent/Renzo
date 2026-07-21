// ============================================================================
// OWNER  : Gauransh
// MODULE : Branch Admin — Leave Management (presentational parts)
//
// Stateless building blocks: the four statistics cards, the status badge and the
// empty / error states. No fetching, no interaction.
// ============================================================================

import * as React from "react";
import { CalendarOff, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import { STATUS_TONE, type LeaveStats, type LeaveStatus } from "./types";

/* ─── Statistics cards ─────────────────────────────────────────────────────
 * Branch-wide counts straight from GET /api/v1/admin/leaves/stats — never derived
 * from the current page of rows, so they stay true even while the table is
 * filtered down to one status.
 */
export function LeaveStatsCards({ stats }: { stats: LeaveStats }) {
  const cards: { label: string; value: number; tone: string }[] = [
    { label: "Pending", value: stats.pending, tone: "text-yellow-700" },
    { label: "Approved", value: stats.approved, tone: "text-green-700" },
    { label: "Rejected", value: stats.rejected, tone: "text-red-600" },
    { label: "Total requests", value: stats.total, tone: "text-gray-900" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded border border-gray-200 bg-white p-4 dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
          <p className="text-xs font-medium text-gray-500 dark:text-[var(--sa-muted)]">{c.label}</p>
          <p className={cn("mt-2 text-2xl font-semibold", c.tone)}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{status}</Badge>;
}

/* ─── Empty & error states ─────────────────────────────────────────────────── */
export function LeavesEmpty({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-dashed border-gray-200 bg-white px-6 py-16 text-center dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-gray-50 text-gray-400 dark:bg-[var(--sa-tile)] dark:text-[var(--sa-muted)]"
      >
        <CalendarOff className="size-6" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-gray-900 dark:text-[var(--sa-text)]">
        {filtered ? "No leave requests match your filters" : "No leave requests yet"}
      </h3>
      <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-[var(--sa-muted)]">
        {filtered
          ? "Try a different search, status or date range."
          : "When your workers apply for leave, their requests will appear here for review."}
      </p>
    </div>
  );
}

export function LeavesError({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-red-100 bg-red-50/50 px-6 py-14 text-center">
      <AlertTriangle className="size-6 text-red-400" aria-hidden="true" />
      <h3 className="mt-3 text-sm font-semibold text-gray-900">Could not load leave requests</h3>
      <p className="mt-1 text-xs text-gray-500">{message}</p>
    </div>
  );
}
