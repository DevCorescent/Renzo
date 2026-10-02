"use client";

// ============================================================================
// MODULE : Attendance — lunch break history (Branch Admin / Super Admin)
//
// One row per worker-day that has a lunch break: start, end, duration, and
// whether it ran past the 30-minute allowance (red, with the minutes over). A
// break still open is counted live, so a worker who has not come back shows up
// as over while it is happening.
//
// Rows come from GET /api/v1/admin/attendance?hasBreak=true — the same branch
// scoping and paging as the attendance records — so nothing here decides who
// may see what.
// ============================================================================

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
import { Card } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import {
  BREAK_ALLOWANCE_MINUTES,
  breakDurationMinutes,
  breakOverMinutes,
} from "@/lib/attendance";
import { AttendanceEmpty } from "@/components/attendance/attendance-ui";
import {
  formatDate,
  formatTime,
  formatWeekday,
  workerName,
  type AttendanceRow,
} from "@/components/attendance/types";

const muted = "text-gray-500 dark:text-(--sa-text-2)";

/** Re-render every 30 s while any break on the page is open. */
function useNow(active: boolean): Date {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function BreakHistoryView({
  rows,
  total,
  overTotal,
  page,
  limit,
  totalPages,
  showBranch,
  exportEndpoint,
}: {
  rows: AttendanceRow[];
  total: number;
  /** Breaks over the allowance across the whole filtered range, not just this page. */
  overTotal: number | null;
  page: number;
  limit: number;
  totalPages: number;
  showBranch: boolean;
  exportEndpoint: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const now = useNow(rows.some((r) => r.breakStart && !r.breakEnd));

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(next));
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  const exportHref = (() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.delete("limit");
    params.set("hasBreak", "true");
    params.set("format", "csv");
    return `${exportEndpoint}?${params.toString()}`;
  })();

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className={cn("space-y-3 transition-opacity", isPending && "opacity-60")}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className={muted}>
          {total} lunch break{total === 1 ? "" : "s"}
          {overTotal != null && (
            <>
              {" · "}
              <span className={overTotal > 0 ? "font-medium text-red-600 dark:text-red-400" : undefined}>
                {overTotal} over {BREAK_ALLOWANCE_MINUTES} min
              </span>
            </>
          )}
        </p>
        {total > 0 && (
          <a
            href={exportHref}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-gray-200 bg-white px-3 text-xs text-gray-600 transition hover:bg-gray-50 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)"
          >
            <Download className="size-3.5" aria-hidden="true" /> Export CSV
          </a>
        )}
      </div>

      {rows.length === 0 ? (
        <AttendanceEmpty
          title="No lunch breaks in this period"
          hint="Breaks appear here once a worker marks Start / End lunch break. Pick another period above to look back."
        />
      ) : (
        <>
        {/* Phones: one card per break, so duration and the over-limit flag are
            never scrolled off-screen. */}
        <ul className="space-y-2 sm:hidden">
          {rows.map((row) => {
            const minutes = breakDurationMinutes(row.breakStart, row.breakEnd, now) ?? 0;
            const over = breakOverMinutes(minutes);
            const open = !row.breakEnd;
            return (
              <li
                key={row.id}
                className={cn(
                  "rounded border bg-white p-3 dark:bg-(--sa-surface)",
                  over > 0 ? "border-red-200 dark:border-red-500/30" : "border-gray-200 dark:border-(--sa-border)"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-(--sa-text)">{workerName(row.worker)}</p>
                    <p className={cn("text-[11px]", muted)}>
                      {formatDate(row.date)} {formatWeekday(row.date)} · {row.worker.employeeCode}
                      {showBranch && row.branch ? ` · ${row.branch.name}` : ""}
                    </p>
                  </div>
                  <p className={cn("shrink-0 text-sm font-semibold tabular-nums", over > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-(--sa-text)")}>
                    {minutes} min{open ? " so far" : ""}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono text-gray-700 dark:text-(--sa-text-2)">
                    {formatTime(row.breakStart)} – {open ? "still on break" : formatTime(row.breakEnd)}
                  </span>
                  {over > 0 ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                      Over by {over} min
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {open ? "Within limit so far" : "Within limit"}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <Card className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 dark:border-(--sa-border) dark:text-(--sa-text-2)">
                <th className="px-4 py-2.5">Employee</th>
                <th className="px-4 py-2.5">Date</th>
                <th className="px-4 py-2.5">Break start</th>
                <th className="px-4 py-2.5">Break end</th>
                <th className="px-4 py-2.5 text-right">Duration</th>
                <th className="px-4 py-2.5">Within {BREAK_ALLOWANCE_MINUTES} min?</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const minutes = breakDurationMinutes(row.breakStart, row.breakEnd, now) ?? 0;
                const over = breakOverMinutes(minutes);
                const open = !row.breakEnd;
                return (
                  <tr key={row.id} className={cn("border-b border-gray-50 last:border-0 dark:border-(--sa-border)", over > 0 && "bg-red-50/60 dark:bg-red-500/5")}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-(--sa-text)">{workerName(row.worker)}</p>
                      <p className={cn("text-[11px]", muted)}>
                        {row.worker.employeeCode}
                        {showBranch && row.branch ? ` · ${row.branch.name}` : ""}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDate(row.date)} <span className={cn("text-xs", muted)}>{formatWeekday(row.date)}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono">{formatTime(row.breakStart)}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono">
                      {open ? <span className="font-sans text-xs font-medium text-amber-700 dark:text-amber-300">Still on break</span> : formatTime(row.breakEnd)}
                    </td>
                    <td className={cn("whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums", over > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-(--sa-text)")}>
                      {minutes} min{open ? " so far" : ""}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {over > 0 ? (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                          Over by {over} min
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          {open ? "Within limit so far" : "Within limit"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        </>
      )}

      {total > 0 && (
        <div className="flex flex-col items-center gap-2 rounded border border-gray-200 bg-white px-4 py-3 text-xs text-gray-500 sm:flex-row sm:justify-between dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)">
          <span>Showing {from}–{to} of {total}</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="h-8 rounded border border-gray-200 px-3 transition hover:bg-gray-50 disabled:opacity-40 dark:border-(--sa-border) dark:hover:bg-white/5"
              >
                Previous
              </button>
              <span className="px-2">{page} / {totalPages}</span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="h-8 rounded border border-gray-200 px-3 transition hover:bg-gray-50 disabled:opacity-40 dark:border-(--sa-border) dark:hover:bg-white/5"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
