"use client";

// ============================================================================
// MODULE : Attendance — reports
//
// Grouping and report-type are URL state, so a report is a link someone can send.
//
// The named reports the brief asks for are not separate screens — they are this
// screen with a preset applied, because that is what they actually are:
//
//   Late report      → ?late=true
//   Overtime report  → ?overtime=true
//   Absent report    → ?status=ABSENT
//   Leave report     → ?status=ON_LEAVE
//
// Building four near-identical pages would have meant four places to fix the day a
// column changed. The presets are one row of buttons over the same table.
// ============================================================================

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Download, FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import { AttendanceEmpty } from "@/components/attendance/attendance-ui";
import {
  formatMinutes,
  type AttendanceReport,
  type ReportGroup,
} from "@/components/attendance/types";

const GROUPS: { value: ReportGroup; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "worker", label: "Per employee" },
  { value: "branch", label: "Per branch" },
  { value: "shift", label: "Per shift" },
];

/** Each preset owns the same three params, so switching between them is clean. */
const PRESETS: { label: string; params: { late?: string; overtime?: string; status?: string } }[] = [
  { label: "All", params: {} },
  { label: "Late", params: { late: "true" } },
  { label: "Overtime", params: { overtime: "true" } },
  { label: "Absent", params: { status: "ABSENT" } },
  { label: "On leave", params: { status: "ON_LEAVE" } },
];

const PRESET_KEYS = ["late", "overtime", "status"] as const;

const chipCls =
  "inline-flex h-8 items-center rounded border px-2.5 text-xs transition focus:outline-none focus:ring-2 focus:ring-gray-900/10";

const btnGhost =
  "inline-flex h-9 items-center gap-1.5 rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition " +
  "hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 " +
  "dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)";

const inputCls =
  "h-9 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-700 outline-none transition " +
  "focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 " +
  "dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)";

export function AttendanceReportView({
  report,
  exportEndpoint,
}: {
  report: AttendanceReport;
  exportEndpoint: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const commit = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
    },
    [router, pathname, searchParams]
  );

  function applyPreset(preset: (typeof PRESETS)[number]) {
    commit((params) => {
      // Clear all three first — otherwise "Late" then "Absent" would silently
      // intersect and report late-AND-absent, which is always empty.
      PRESET_KEYS.forEach((key) => params.delete(key));
      Object.entries(preset.params).forEach(([key, value]) => params.set(key, value));
    });
  }

  function isPresetActive(preset: (typeof PRESETS)[number]): boolean {
    const current = Object.fromEntries(
      PRESET_KEYS.map((key) => [key, searchParams.get(key) ?? undefined])
    );
    const target = { late: undefined, overtime: undefined, status: undefined, ...preset.params };
    return PRESET_KEYS.every((key) => current[key] === target[key]);
  }

  function exportHref(format: "csv" | "excel" | "pdf") {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("groupBy");
    params.set("format", format);
    return `${exportEndpoint}?${params.toString()}`;
  }

  const { totals } = report;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-gray-500 dark:text-(--sa-text-2)" htmlFor="report-group">
            Group by
          </label>
          <select
            id="report-group"
            value={report.groupBy}
            onChange={(e) => commit((params) => params.set("groupBy", e.target.value))}
            className={inputCls}
          >
            {GROUPS.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>

          <span className="ml-2 flex flex-wrap items-center gap-1.5">
            {PRESETS.map((preset) => {
              const active = isPresetActive(preset);
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    chipCls,
                    active
                      ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)"
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-(--sa-muted)">
            <Download className="size-3.5" aria-hidden="true" /> Export
          </span>
          <a href={exportHref("csv")} download className={btnGhost}>
            <Table2 className="size-3.5" aria-hidden="true" /> CSV
          </a>
          <a href={exportHref("excel")} download className={btnGhost}>
            <FileSpreadsheet className="size-3.5" aria-hidden="true" /> Excel
          </a>
          <a href={exportHref("pdf")} download className={btnGhost}>
            <FileText className="size-3.5" aria-hidden="true" /> PDF
          </a>
        </div>
      </div>

      {report.truncated && (
        <p className="rounded border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
          This range exceeds the report limit, so it was trimmed to {report.rowCount.toLocaleString("en-IN")} records.
          Narrow the date range for exact totals.
        </p>
      )}

      <Card className={cn("transition-opacity", isPending && "opacity-60")}>
        <CardHeader>
          <CardTitle>
            {GROUPS.find((g) => g.value === report.groupBy)?.label ?? "Report"}
            <span className="ml-2 font-normal text-gray-400 dark:text-(--sa-muted)">
              {report.range.from} → {report.range.to}
            </span>
          </CardTitle>
          <span className="text-xs text-gray-400 dark:text-(--sa-muted)">
            {report.rowCount.toLocaleString("en-IN")} records
          </span>
        </CardHeader>

        <Table>
          <THead>
            <tr>
              <TH>{report.groupBy === "worker" ? "Employee" : report.groupBy === "branch" ? "Branch" : report.groupBy === "shift" ? "Shift" : "Period"}</TH>
              <TH>Records</TH>
              <TH>Present</TH>
              <TH>Late</TH>
              <TH>Half day</TH>
              <TH>Absent</TH>
              <TH>Leave</TH>
              <TH>Attendance</TH>
              <TH>Working</TH>
              <TH>Overtime</TH>
              <TH>Late mins</TH>
              <TH>Avg / day</TH>
            </tr>
          </THead>
          <tbody>
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={12}>
                  <AttendanceEmpty
                    icon={BarChart3}
                    title="No data for this report"
                    hint="Nothing matches these filters and date range."
                  />
                </td>
              </tr>
            ) : (
              report.rows.map((row) => (
                <TR key={row.key}>
                  <TD>
                    <span className="block text-sm text-gray-800 dark:text-(--sa-text)">{row.label}</span>
                    {row.sublabel && (
                      <span className="block font-mono text-[11px] text-gray-400 dark:text-(--sa-muted)">{row.sublabel}</span>
                    )}
                  </TD>
                  <TD className="text-xs text-gray-600 dark:text-(--sa-text-2)">{row.total}</TD>
                  <TD className="text-xs text-emerald-700 dark:text-emerald-400">{row.present}</TD>
                  <TD className="text-xs text-amber-700 dark:text-amber-400">{row.late}</TD>
                  <TD className="text-xs text-sky-700 dark:text-sky-400">{row.halfDay}</TD>
                  <TD className="text-xs text-red-600 dark:text-red-400">{row.absent}</TD>
                  <TD className="text-xs text-violet-700 dark:text-violet-400">{row.onLeave}</TD>
                  <TD className="text-xs font-medium text-gray-800 dark:text-(--sa-text)">
                    {row.attendancePct === null ? "—" : `${row.attendancePct}%`}
                  </TD>
                  <TD className="whitespace-nowrap text-xs text-gray-700 dark:text-(--sa-text)">{formatMinutes(row.workingMinutes)}</TD>
                  <TD className="whitespace-nowrap text-xs text-gray-600 dark:text-(--sa-text-2)">{formatMinutes(row.overtimeMinutes)}</TD>
                  <TD className="text-xs text-gray-600 dark:text-(--sa-text-2)">{row.lateMinutes}</TD>
                  <TD className="whitespace-nowrap text-xs text-gray-600 dark:text-(--sa-text-2)">{formatMinutes(row.avgWorkingMinutes)}</TD>
                </TR>
              ))
            )}

            {report.rows.length > 0 && (
              <TR className="border-t-2 border-gray-200 bg-gray-50/80 font-medium dark:border-(--sa-border) dark:bg-white/5">
                <TD className="text-sm text-gray-900 dark:text-(--sa-text)">Total</TD>
                <TD className="text-xs text-gray-800 dark:text-(--sa-text)">{totals.total}</TD>
                <TD className="text-xs text-emerald-700 dark:text-emerald-400">{totals.present}</TD>
                <TD className="text-xs text-amber-700 dark:text-amber-400">{totals.late}</TD>
                <TD className="text-xs text-sky-700 dark:text-sky-400">{totals.halfDay}</TD>
                <TD className="text-xs text-red-600 dark:text-red-400">{totals.absent}</TD>
                <TD className="text-xs text-violet-700 dark:text-violet-400">{totals.onLeave}</TD>
                <TD className="text-xs text-gray-900 dark:text-(--sa-text)">
                  {totals.attendancePct === null ? "—" : `${totals.attendancePct}%`}
                </TD>
                <TD className="whitespace-nowrap text-xs text-gray-900 dark:text-(--sa-text)">{formatMinutes(totals.workingMinutes)}</TD>
                <TD className="whitespace-nowrap text-xs text-gray-900 dark:text-(--sa-text)">{formatMinutes(totals.overtimeMinutes)}</TD>
                <TD className="text-xs text-gray-900 dark:text-(--sa-text)">{totals.lateMinutes}</TD>
                <TD className="whitespace-nowrap text-xs text-gray-900 dark:text-(--sa-text)">{formatMinutes(totals.avgWorkingMinutes)}</TD>
              </TR>
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
