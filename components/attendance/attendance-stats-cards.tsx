// ============================================================================
// MODULE : Attendance — dashboard cards
//
// The headline board for one date. Every number comes from
// GET /api/v1/admin/attendance/summary, which derives them with the same
// summarizeAttendance() the reports and exports use — so these cards cannot drift
// from the table underneath them.
//
// Layout: one "Marked today" progress card and the four numbers a manager acts on
// (present, late, absent, working now) up top; everything else in one compact
// strip below. Twelve equal cards made every figure look equally urgent.
//
// "Not marked" is shown alongside "Absent" on purpose. They are different facts:
// absent means someone was recorded as not turning up; not-marked means nobody has
// said anything about them yet. Collapsing the two would let a branch that has
// marked nobody look like a branch where everybody is present.
// ============================================================================

import {
  CalendarCheck,
  CheckCircle2,
  TriangleAlert,
  UserMinus,
  Users,
} from "lucide-react";
import { Card } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import { formatMinutes, type AttendanceSummary } from "@/components/attendance/types";

type Tone = "emerald" | "amber" | "red" | "sky";

const TONE_ICON: Record<Tone, string> = {
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  red: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
  sky: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
};

export function AttendanceStatsCards({ summary }: { summary: AttendanceSummary }) {
  const marked = summary.total;
  const expected = summary.activeWorkers;
  const markedPct = expected > 0 ? Math.min(100, Math.round((marked / expected) * 100)) : 0;

  const headline: {
    label: string;
    value: number;
    hint: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: Tone;
  }[] = [
    { label: "Present", value: summary.present, hint: "on time", icon: CheckCircle2, tone: "emerald" },
    {
      label: "Late",
      value: summary.late,
      hint: summary.lateMinutes > 0 ? `${summary.lateMinutes} min in total` : "nobody late",
      icon: TriangleAlert,
      tone: "amber",
    },
    { label: "Absent", value: summary.absent, hint: "recorded absent", icon: UserMinus, tone: "red" },
    { label: "Working now", value: summary.working, hint: "clocked in, not out", icon: Users, tone: "sky" },
  ];

  const secondary = [
    { label: "Half day", value: String(summary.halfDay) },
    { label: "On leave", value: String(summary.onLeave) },
    { label: "Checked in", value: String(summary.checkedIn + summary.checkedOut) },
    { label: "Checked out", value: String(summary.checkedOut) },
    { label: "Total hours", value: formatMinutes(summary.workingMinutes) },
    { label: "Avg hours / day", value: formatMinutes(summary.avgWorkingMinutes) },
    { label: "Avg late", value: `${summary.avgLateMinutes} min` },
  ];

  return (
    <section aria-label="Attendance summary" className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(15rem,1fr)_3fr]">
        <Card className="flex flex-col justify-between gap-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-(--sa-text-2)">Marked today</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-gray-900 dark:text-(--sa-text)">
                {marked}
                <span className="text-lg font-normal text-gray-400 dark:text-(--sa-muted)"> / {expected}</span>
              </p>
            </div>
            <span className="flex size-8 items-center justify-center rounded-md bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-(--sa-text-2)">
              <CalendarCheck className="size-4" aria-hidden="true" />
            </span>
          </div>
          <div>
            <div
              role="progressbar"
              aria-label="Staff marked today"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={markedPct}
              className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10"
            >
              <div className="h-full rounded-full bg-gray-900 transition-[width] dark:bg-white" style={{ width: `${markedPct}%` }} />
            </div>
            <p className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-(--sa-text-2)">
              <span>{summary.notMarked > 0 ? `${summary.notMarked} not marked yet` : "Everyone accounted for"}</span>
              {summary.attendancePct !== null && <span>{summary.attendancePct}% attendance</span>}
            </p>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {headline.map(({ label, value, hint, icon: Icon, tone }) => (
            <Card key={label} className="flex flex-col p-4">
              <div className="flex items-center gap-2">
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", TONE_ICON[tone])}>
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <p className="truncate text-xs font-medium text-gray-500 dark:text-(--sa-text-2)">{label}</p>
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-gray-900 dark:text-(--sa-text)">{value}</p>
              <p className="mt-0.5 truncate text-xs text-gray-400 dark:text-(--sa-muted)">{hint}</p>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3 sm:grid-cols-4 lg:grid-cols-7">
          {secondary.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="truncate text-[11px] text-gray-500 dark:text-(--sa-text-2)">{item.label}</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums text-gray-900 dark:text-(--sa-text)">{item.value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </section>
  );
}
