"use client";

// ============================================================================
// MODULE : Attendance — monthly calendar
//
// TWO MODES, chosen by the server from whether a worker filter is active:
//
//   worker — one status per day, so the cell can be filled with that status's
//            colour. This is the individual's month.
//   branch — a status BREAKDOWN per day. A branch day is not one status, and
//            painting it with the majority colour would hide the three people who
//            were absent. Each cell shows a stacked bar of the day's mix instead.
//
// Month navigation is URL state (?month=YYYY-MM), so a month is linkable and the
// browser Back button steps through it.
// ============================================================================

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarX2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import { AttendanceEmpty, STATUS_FILL, StatusLegend } from "@/components/attendance/attendance-ui";
import {
  ATTENDANCE_STATUSES,
  formatMinutes,
  statusLabel,
  WEEKDAY_LABELS,
  type AttendanceCalendar as CalendarData,
  type AttendanceStatus,
  type CalendarDay,
} from "@/components/attendance/types";

/** "2026-08" → "2026-07". Pure string/UTC arithmetic — no local-time drift. */
function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, m - 1, 1))
  );
}

/** Stacked proportional bar of a branch day's status mix. */
function DayMix({ counts, total }: { counts: Record<AttendanceStatus, number>; total: number }) {
  const present = ATTENDANCE_STATUSES.filter((s) => counts[s] > 0);

  return (
    <div className="mt-1 space-y-1">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
        {present.map((status) => (
          <span
            key={status}
            className={cn("h-full", STATUS_FILL[status])}
            style={{ width: `${(counts[status] / total) * 100}%` }}
            title={`${statusLabel(status)}: ${counts[status]}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-[10px] leading-tight text-gray-500 dark:text-(--sa-text-2)">
        {present.slice(0, 3).map((status) => (
          <span key={status}>
            {statusLabel(status).slice(0, 3)} {counts[status]}
          </span>
        ))}
      </div>
    </div>
  );
}

function DayCell({ day, mode }: { day: CalendarDay; mode: "worker" | "branch" }) {
  const dayNumber = Number(day.date.slice(8, 10));
  const isWeekend = day.dayOfWeek === 0;

  const filled = mode === "worker" && day.status;

  return (
    <div
      className={cn(
        "min-h-18.5 rounded border p-1.5 text-left transition",
        filled
          ? "border-transparent"
          : "border-gray-100 bg-white dark:border-(--sa-border) dark:bg-(--sa-surface)",
        filled && day.status ? STATUS_FILL[day.status] : "",
        !filled && isWeekend && "bg-gray-50/60 dark:bg-white/5"
      )}
    >
      <div className="flex items-baseline justify-between">
        <span
          className={cn(
            "text-xs font-semibold",
            filled ? "" : "text-gray-700 dark:text-(--sa-text)"
          )}
        >
          {dayNumber}
        </span>
        {mode === "branch" && day.total > 0 && (
          <span className="text-[10px] text-gray-400 dark:text-(--sa-muted)">{day.total}</span>
        )}
      </div>

      {mode === "worker" ? (
        day.status ? (
          <div className="mt-1 space-y-0.5 text-[10px] leading-tight opacity-95">
            <p className="font-medium">{statusLabel(day.status)}</p>
            {day.record && (
              <>
                <p>{day.record.checkIn} – {day.record.checkOut}</p>
                {day.record.workingMinutes > 0 && <p>{formatMinutes(day.record.workingMinutes)}</p>}
                {day.record.lateMinutes > 0 && <p>Late {day.record.lateMinutes}m</p>}
              </>
            )}
          </div>
        ) : (
          <p className="mt-1 text-[10px] text-gray-300 dark:text-(--sa-muted)">Not marked</p>
        )
      ) : day.total > 0 && day.counts ? (
        <DayMix counts={day.counts} total={day.total} />
      ) : (
        <p className="mt-1 text-[10px] text-gray-300 dark:text-(--sa-muted)">—</p>
      )}
    </div>
  );
}

export function AttendanceCalendarGrid({ data }: { data: CalendarData }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  function goToMonth(month: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", month);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  // Pad the grid so the 1st lands under its real weekday. `days` is always a full
  // month from the API, so only a leading offset is needed.
  const leadingBlanks = data.days.length > 0 ? data.days[0].dayOfWeek : 0;

  return (
    <Card className={cn("transition-opacity", isPending && "opacity-60")}>
      <CardHeader>
        <CardTitle>{monthLabel(data.month)}</CardTitle>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goToMonth(shiftMonth(data.month, -1))}
            aria-label="Previous month"
            className="rounded border border-gray-200 p-1.5 text-gray-500 transition hover:bg-gray-50 dark:border-(--sa-border) dark:hover:bg-white/5"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => goToMonth(shiftMonth(data.month, 1))}
            aria-label="Next month"
            className="rounded border border-gray-200 p-1.5 text-gray-500 transition hover:bg-gray-50 dark:border-(--sa-border) dark:hover:bg-white/5"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </CardHeader>

      <CardBody className="space-y-3">
        <StatusLegend />

        {data.days.length === 0 ? (
          <AttendanceEmpty icon={CalendarX2} title="No days to show" />
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="pb-1 text-center text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-(--sa-muted)"
              >
                {label}
              </div>
            ))}

            {Array.from({ length: leadingBlanks }, (_, i) => (
              <div key={`blank-${i}`} aria-hidden="true" />
            ))}

            {data.days.map((day) => (
              <DayCell key={day.date} day={day} mode={data.mode} />
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 dark:text-(--sa-muted)">
          {data.mode === "worker"
            ? "Showing one employee's month. Clear the employee filter to see the whole branch."
            : "Each cell shows the day's status mix across all employees. Filter to one employee for a personal calendar."}
        </p>
      </CardBody>
    </Card>
  );
}
