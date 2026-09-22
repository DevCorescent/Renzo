"use client";

import * as React from "react";
import { ExportMenu, type ExportFormat } from "@/components/shared/export-menu";
import { downloadCSV, downloadPDF, type ReportMeta } from "@/lib/report-export";
import { REPORTS_OPTIONS, buildReportsReport, type ExportData, type ReportsId } from "./report-builders";

type Period = "month" | "lastMonth" | "week" | "last7" | "today" | "year" | "custom";

const PERIODS: { id: Period; label: string }[] = [
  { id: "month",     label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "week",      label: "This week" },
  { id: "last7",     label: "Last 7 days" },
  { id: "today",     label: "Today" },
  { id: "year",      label: "This year" },
  { id: "custom",    label: "Custom…" },
];

const MONTH_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTH      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Local-calendar YYYY-MM-DD. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rangeFor(p: Period, cf: string, ct: string): [string, string] {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const y = t.getFullYear(), m = t.getMonth();
  switch (p) {
    case "month":     return [ymd(new Date(y, m, 1)), ymd(new Date(y, m + 1, 0))];
    case "lastMonth": return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))];
    case "week": {
      const s = new Date(t); s.setDate(t.getDate() - ((t.getDay() + 6) % 7));
      const e = new Date(s); e.setDate(s.getDate() + 6);
      return [ymd(s), ymd(e)];
    }
    case "last7": { const s = new Date(t); s.setDate(t.getDate() - 6); return [ymd(s), ymd(t)]; }
    case "today":     return [ymd(t), ymd(t)];
    case "year":      return [ymd(new Date(y, 0, 1)), ymd(new Date(y, 11, 31))];
    case "custom":    return [cf, ct];
  }
}

function label(p: Period, from: string, to: string): string {
  const f = new Date(from + "T00:00:00"), t = new Date(to + "T00:00:00");
  if (p === "month" || p === "lastMonth") return `${MONTH_LONG[f.getMonth()]} ${f.getFullYear()}`;
  if (p === "year") return String(f.getFullYear());
  const one = (d: Date) => `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
  return from === to ? one(f) : `${one(f)} – ${one(t)}`;
}

export function ReportsExport() {
  const today = ymd(new Date());
  const [period, setPeriod] = React.useState<Period>("month");
  const [customFrom, setCustomFrom] = React.useState(today);
  const [customTo, setCustomTo] = React.useState(today);
  const cache = React.useRef<{ key: string; data: ExportData } | null>(null);

  const [from, to] = rangeFor(period, customFrom, customTo);
  const periodLabel = label(period, from, to);

  async function load(): Promise<ExportData> {
    const key = `${from}:${to}`;
    if (cache.current?.key === key) return cache.current.data;
    const res = await fetch(`/api/v1/branch-admin/reports/export?from=${from}&to=${to}`);
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) throw new Error(json?.message ?? json?.error ?? "Could not load report data.");
    cache.current = { key, data: json.data as ExportData };
    return json.data as ExportData;
  }

  async function onExport(id: ReportsId, format: ExportFormat) {
    if (from > to) throw new Error("The start date must be before the end date.");
    const data = await load();
    const report = buildReportsReport(id, data);
    const meta: ReportMeta = {
      orgName: data.branchName,
      periodLabel,
      from, to,
    };
    if (format === "csv") downloadCSV(report, meta);
    else await downloadPDF(report, meta);
  }

  const field = "rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/20";

  return (
    <ExportMenu
      options={REPORTS_OPTIONS}
      onExport={onExport}
      subtitle="Pick a period, then choose a report."
      header={
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label htmlFor="report-period" className="text-[11px] font-medium text-gray-600">Period</label>
            <select
              id="report-period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className={`${field} flex-1`}
            >
              {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)} className={`${field} flex-1`} />
              <span className="text-xs text-gray-400">→</span>
              <input type="date" value={customTo} min={customFrom} onChange={(e) => setCustomTo(e.target.value)} className={`${field} flex-1`} />
            </div>
          )}
          <div className="text-[11px] font-semibold text-gray-900">{periodLabel}</div>
        </div>
      }
    />
  );
}
