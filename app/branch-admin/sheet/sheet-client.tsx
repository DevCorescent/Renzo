"use client";

import * as React from "react";
import {
  ChevronLeft, ChevronRight, Eye, EyeOff, Filter, Plus, RotateCcw, Save, X,
} from "lucide-react";
import {
  REPORT_OPTIONS, displayDate, downloadCSV, downloadPDF, fromYMD, inr, money, parseEntry, sumEntries,
  type ReportId, type ReportInput, type Worker,
} from "./sheet-reports";
import { ExportMenu } from "@/components/shared/export-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SheetLog {
  date: string;
  cells: Record<string, string[]>;
}

interface Props {
  initialWorkers: Worker[];
  branchName: string;
}

type DateRange = "day" | "week" | "month" | "custom";

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Local-calendar YYYY-MM-DD. (toISOString() would shift the day in IST.) */
function toYMD(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfISOWeek(d: Date): Date {
  const day = d.getDay();
  return addDays(d, day === 0 ? -6 : 1 - day);
}

function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(from); cur.setHours(0, 0, 0, 0);
  const end = new Date(to);   end.setHours(0, 0, 0, 0);
  while (cur <= end) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return days;
}

const DAY        = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH      = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function rangeForPreset(preset: DateRange, anchor: string, cf: string, ct: string): [string, string] {
  const a = fromYMD(anchor);
  if (preset === "day") return [anchor, anchor];
  if (preset === "week") {
    const sw = startOfISOWeek(a);
    return [toYMD(sw), toYMD(addDays(sw, 6))];
  }
  if (preset === "month") {
    return [
      toYMD(new Date(a.getFullYear(), a.getMonth(), 1)),
      toYMD(new Date(a.getFullYear(), a.getMonth() + 1, 0)),
    ];
  }
  return [cf, ct];
}

function shiftAnchor(preset: DateRange, anchor: string, dir: 1 | -1): string {
  const a = fromYMD(anchor);
  if (preset === "day")  return toYMD(addDays(a, dir));
  if (preset === "week") return toYMD(addDays(a, 7 * dir));
  return toYMD(new Date(a.getFullYear(), a.getMonth() + dir, 1));
}

function rangeLabel(preset: DateRange, from: string, to: string): string {
  const f = fromYMD(from), t = fromYMD(to);
  if (preset === "day")   return `${DAY[f.getDay()]}, ${f.getDate()} ${MONTH_LONG[f.getMonth()]} ${f.getFullYear()}`;
  if (preset === "month") return `${MONTH_LONG[f.getMonth()]} ${f.getFullYear()}`;
  if (f.getMonth() === t.getMonth()) return `${f.getDate()} – ${t.getDate()} ${MONTH[t.getMonth()]} ${t.getFullYear()}`;
  return `${f.getDate()} ${MONTH[f.getMonth()]} – ${t.getDate()} ${MONTH[t.getMonth()]} ${t.getFullYear()}`;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}

// ─── CellInput — ledger-style list for one worker/day cell ───────────────────

function CellInput({
  values,
  isSaving,
  onChange,
}: {
  values: string[];
  isSaving: boolean;
  onChange: (next: string[]) => void;
}) {
  const [adding,    setAdding]    = React.useState(false);
  const [draft,     setDraft]     = React.useState("");
  const [editIdx,   setEditIdx]   = React.useState<number | null>(null);
  const [editDraft, setEditDraft] = React.useState("");

  const parsed = React.useMemo(() => values.map(parseEntry), [values]);
  const total  = React.useMemo(() => sumEntries(values), [values]);
  const priced = parsed.filter((p) => p.amount !== null).length;

  function openAdd() {
    setEditIdx(null);
    setAdding(true);
  }

  // Enter keeps the input open so a run of amounts can be typed in one go.
  function commitAdd(close: boolean) {
    const v = draft.trim();
    if (v) onChange([...values, v]);
    setDraft("");
    if (close) setAdding(false);
  }

  function startEdit(i: number) {
    setAdding(false);
    setEditIdx(i);
    setEditDraft(values[i] ?? "");
  }

  function commitEdit() {
    if (editIdx === null) return;
    const v = editDraft.trim();
    if (v !== values[editIdx]) {
      onChange(v ? values.map((x, i) => (i === editIdx ? v : x)) : values.filter((_, i) => i !== editIdx));
    }
    setEditIdx(null);
  }

  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i));
  }

  const active = adding || editIdx !== null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !active) openAdd(); }}
      className={`group relative flex min-h-[36px] h-full cursor-text flex-col px-2.5 py-1.5 transition-colors ${
        active
          ? "bg-blue-50/70 ring-2 ring-inset ring-blue-400/60 dark:bg-blue-900/20"
          : "hover:bg-gray-50"
      }`}
    >
      {/* Entries — one per line, amounts right-aligned like a ledger */}
      {parsed.map((p, i) =>
        editIdx === i ? (
          <input
            key={i}
            autoFocus
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter")  { e.preventDefault(); commitEdit(); }
              if (e.key === "Escape") setEditIdx(null);
            }}
            onBlur={commitEdit}
            className="my-0.5 w-full rounded border border-blue-300 bg-white px-1.5 py-0.5 text-xs text-gray-800 focus:outline-none dark:border-blue-500"
          />
        ) : (
          <div key={i} className="group/line -mx-1 flex items-center gap-1 rounded px-1 hover:bg-gray-100">
            <button
              type="button"
              onClick={() => startEdit(i)}
              title={values[i]}
              className="flex min-w-0 flex-1 items-baseline gap-1.5 py-[3px] text-left"
            >
              {p.label !== null && (
                <span className={`min-w-0 flex-1 truncate ${
                  p.amount === null
                    ? "text-xs text-gray-700"
                    : "text-[11px] text-gray-500"
                }`}>
                  {p.label}
                </span>
              )}
              {p.amount !== null && (
                <span className="ml-auto whitespace-nowrap text-[13px] font-semibold tabular-nums text-gray-900">
                  {inr.format(p.amount)}
                  {p.tag && (
                    <span className="ml-0.5 align-top text-[9px] font-bold text-emerald-600 dark:text-emerald-400">{p.tag}</span>
                  )}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              className="shrink-0 text-gray-300 opacity-0 transition hover:text-red-500 focus:opacity-100 group-hover/line:opacity-100"
              aria-label={`Remove ${values[i]}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )
      )}

      {/* Add */}
      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")  { e.preventDefault(); commitAdd(false); }
            if (e.key === "Escape") { setDraft(""); setAdding(false); }
          }}
          onBlur={() => commitAdd(true)}
          placeholder="e.g. 200 ↵"
          className="my-0.5 w-full rounded border border-blue-300 bg-white px-1.5 py-0.5 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none dark:border-blue-500"
        />
      ) : (
        <button
          type="button"
          onClick={openAdd}
          className="-ml-1 mt-0.5 inline-flex w-fit items-center gap-0.5 rounded px-1 py-0.5 text-[10px] text-gray-400 opacity-0 transition-opacity hover:text-gray-700 focus:opacity-100 group-hover:opacity-100"
          aria-label="Add entry"
        >
          <Plus className="h-3 w-3" /> add
        </button>
      )}

      {/* Subtotal — only worth showing when there's something to add up */}
      {priced > 1 && (
        <div className="mt-auto flex items-baseline justify-between border-t border-dashed border-gray-300 pt-1">
          <span className="text-[10px] uppercase tracking-wide text-gray-400">{values.length} entries</span>
          <span className="text-xs font-bold tabular-nums text-gray-900">{money(total)}</span>
        </div>
      )}

      {isSaving && (
        <span className="pointer-events-none absolute right-1 top-1">
          <Save className="h-2.5 w-2.5 animate-pulse text-blue-400" />
        </span>
      )}
    </div>
  );
}

// ─── Summary tile ─────────────────────────────────────────────────────────────

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-gray-200 bg-white px-3.5 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</span>
        {hint && <span className="truncate text-[11px] text-gray-400">{hint}</span>}
      </div>
      <div className="mt-0.5 truncate text-lg font-semibold capitalize tabular-nums text-gray-900">{value}</div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SheetClient({ initialWorkers, branchName }: Props) {
  const todayYMD = toYMD(new Date());

  const [workers, setWorkers] = React.useState<Worker[]>(initialWorkers);
  // cells: key = "YYYY-MM-DD:workerId", value = string[]
  const [cells, setCells] = React.useState<Record<string, string[]>>({});

  const [preset,     setPreset]     = React.useState<DateRange>("week");
  const [anchor,     setAnchor]     = React.useState(todayYMD);
  const [customFrom, setCustomFrom] = React.useState(todayYMD);
  const [customTo,   setCustomTo]   = React.useState(todayYMD);

  const [from, to] = rangeForPreset(preset, anchor, customFrom, customTo);

  const dates = React.useMemo(() => {
    try { return eachDay(fromYMD(from), fromYMD(to)).map(toYMD); }
    catch { return []; }
  }, [from, to]);

  const [loading,   setLoading]   = React.useState(false);
  const [loadedOnce, setLoadedOnce] = React.useState(false);
  const [saving,    setSaving]    = React.useState<Set<string>>(new Set());
  const [filter,    setFilter]    = React.useState("");
  const [hideEmpty, setHideEmpty] = React.useState(false);

  const debounceRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const requestRef  = React.useRef(0);

  // ── Filtered workers ─────────────────────────────────────────────────────
  const filteredWorkers = React.useMemo(() =>
    filter.trim()
      ? workers.filter(
          (w) =>
            w.name.toLowerCase().includes(filter.toLowerCase()) ||
            (w.designation ?? "").toLowerCase().includes(filter.toLowerCase())
        )
      : workers,
    [workers, filter]
  );

  // ── Fetch data ────────────────────────────────────────────────────────────
  const fetchData = React.useCallback(async () => {
    if (!from || !to || from > to) return;
    const reqId = ++requestRef.current;
    setLoading(true);
    try {
      const res  = await fetch(`/api/v1/branch-admin/sheet?from=${from}&to=${to}`);
      const json = await res.json();
      if (reqId !== requestRef.current || !json.success) return;

      const fetchedWorkers: Worker[] = json.data.workers;
      setWorkers(fetchedWorkers.length ? fetchedWorkers : initialWorkers);

      const map: Record<string, string[]> = {};
      for (const log of json.data.logs as SheetLog[]) {
        for (const [wId, val] of Object.entries(log.cells)) {
          const arr = Array.isArray(val)
            ? (val as unknown[]).filter((v): v is string => typeof v === "string")
            : typeof val === "string" && val ? [val]
            : [];
          if (arr.length > 0) map[`${log.date}:${wId}`] = arr;
        }
      }
      setCells(map);
    } finally {
      if (reqId === requestRef.current) { setLoading(false); setLoadedOnce(true); }
    }
  }, [from, to, initialWorkers]);

  React.useEffect(() => { fetchData(); }, [fetchData]);

  // ── Cell change + debounced save ─────────────────────────────────────────
  function handleCellValues(date: string, workerId: string, values: string[]) {
    const key = `${date}:${workerId}`;
    setCells((prev) => {
      const next = { ...prev };
      if (values.length > 0) { next[key] = values; }
      else { delete next[key]; }
      return next;
    });

    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(() => saveCell(date, workerId, values), 400);
  }

  async function saveCell(date: string, workerId: string, values: string[]) {
    const key = `${date}:${workerId}`;
    setSaving((prev) => new Set(prev).add(key));
    try {
      await fetch("/api/v1/branch-admin/sheet", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, workerId, value: values }),
      });
    } finally {
      setSaving((prev) => { const s = new Set(prev); s.delete(key); return s; });
    }
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const totals = React.useMemo(() => {
    const byWorker: Record<string, number> = {};
    const countByWorker: Record<string, number> = {};
    const byDate: Record<string, number> = {};
    const countByDate: Record<string, number> = {};
    let grand = 0, entries = 0;
    for (const d of dates) {
      for (const w of filteredWorkers) {
        const vals = cells[`${d}:${w.id}`];
        if (!vals?.length) continue;
        const sum = sumEntries(vals);
        byWorker[w.id]      = (byWorker[w.id] ?? 0) + sum;
        countByWorker[w.id] = (countByWorker[w.id] ?? 0) + vals.length;
        byDate[d]           = (byDate[d] ?? 0) + sum;
        countByDate[d]      = (countByDate[d] ?? 0) + vals.length;
        grand   += sum;
        entries += vals.length;
      }
    }
    const activeDays = Object.keys(countByDate).length;
    let top: Worker | null = null;
    for (const w of filteredWorkers) if ((byWorker[w.id] ?? 0) > (top ? byWorker[top.id] ?? 0 : 0)) top = w;
    return { byWorker, countByWorker, byDate, countByDate, grand, entries, activeDays, top };
  }, [cells, dates, filteredWorkers]);

  const visibleDates = React.useMemo(
    () => hideEmpty ? dates.filter((d) => totals.countByDate[d] || d === todayYMD) : dates,
    [hideEmpty, dates, totals.countByDate, todayYMD]
  );

  // ── Report exports ────────────────────────────────────────────────────────
  // Every report uses what is on screen: the current range, worker filter and
  // the "hide empty days" choice.
  function exportReport(id: ReportId, format: "csv" | "pdf") {
    const input: ReportInput = {
      branchName,
      periodLabel: rangeLabel(preset, from, to),
      from, to,
      dates: visibleDates,
      workers: filteredWorkers,
      cells,
    };
    if (format === "csv") downloadCSV(id, input);
    else return downloadPDF(id, input);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const btn = "rounded-md border border-gray-200 bg-white text-gray-600 transition-colors hover:bg-gray-50";
  const todayInRange = todayYMD >= from && todayYMD <= to;
  const avgPerDay = totals.activeDays ? totals.grand / totals.activeDays : 0;

  return (
    // Fill exactly the space under the app header (h-14) minus main's p-6, so only
    // the table scrolls — never the page.
    <div className="flex h-[calc(100dvh-104px)] min-h-[480px] flex-col gap-3">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">Sheet</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {rangeLabel(preset, from, to)}
            {" · "}{filteredWorkers.length} worker{filteredWorkers.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Presets — segmented */}
          <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5">
            {(["day","week","month","custom"] as DateRange[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                  preset === p
                    ? "bg-gray-900 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {p === "day" ? "Day" : p === "week" ? "Week" : p === "month" ? "Month" : "Custom"}
              </button>
            ))}
          </div>

          {/* Step through days / weeks / months */}
          {preset !== "custom" ? (
            <div className="inline-flex items-center gap-1">
              <button onClick={() => setAnchor(shiftAnchor(preset, anchor, -1))} className={`${btn} p-1.5`} aria-label="Previous">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setAnchor(todayYMD)}
                disabled={todayInRange}
                className={`${btn} px-3 py-1.5 text-xs font-medium disabled:opacity-40`}
              >
                Today
              </button>
              <button onClick={() => setAnchor(shiftAnchor(preset, anchor, 1))} className={`${btn} p-1.5`} aria-label="Next">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5">
              <input type="date" value={customFrom} max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700" />
              <span className="text-sm text-gray-400">→</span>
              <input type="date" value={customTo} min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700" />
            </div>
          )}

          {/* Filter */}
          <div className="relative">
            <Filter className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Filter workers…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-40 rounded-md border border-gray-200 bg-white py-1.5 pl-7 pr-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            />
          </div>

          {dates.length > 1 && (
            <button
              onClick={() => setHideEmpty((v) => !v)}
              className={`${btn} flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium`}
              title={hideEmpty ? "Show every day in the range" : "Hide days with no entries"}
            >
              {hideEmpty ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {hideEmpty ? "Show all days" : "Hide empty days"}
            </button>
          )}

          <button onClick={fetchData} disabled={loading} className={`${btn} p-1.5 disabled:opacity-40`} title="Refresh">
            <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <ExportMenu
            options={REPORT_OPTIONS}
            onExport={exportReport}
            subtitle="Uses the dates, worker filter and hidden days you have on screen."
          />
        </div>
      </div>

      {/* ── Summary ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total" value={money(totals.grand)} hint={`${totals.entries} entr${totals.entries === 1 ? "y" : "ies"}`} />
        {todayInRange && dates.length > 1 ? (
          <Stat label="Today" value={money(totals.byDate[todayYMD] ?? 0)} hint={`${totals.countByDate[todayYMD] ?? 0} entries so far`} />
        ) : (
          <Stat label="Active days" value={String(totals.activeDays)} hint={`of ${dates.length} day${dates.length !== 1 ? "s" : ""}`} />
        )}
        <Stat label="Avg per active day" value={money(Math.round(avgPerDay))} hint={`${totals.activeDays} active day${totals.activeDays !== 1 ? "s" : ""}`} />
        <Stat
          label="Top worker"
          value={totals.top ? totals.top.name : "—"}
          hint={totals.top ? money(totals.byWorker[totals.top.id] ?? 0) : "No entries yet"}
        />
      </div>

      {/* ── Sheet Table ──────────────────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1 overflow-y-auto overflow-x-scroll rounded-lg border border-gray-200 bg-white shadow-sm">
        {!loadedOnce && loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">Loading…</div>
        ) : filteredWorkers.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">No workers found.</div>
        ) : (
          // Fixed layout: worker columns share the width equally and the table fits
          // the screen; below 160px per worker it scrolls sideways instead of truncating
          // service names. The container always shows its horizontal scrollbar.
          <table
            style={{ minWidth: 120 + 110 + filteredWorkers.length * 160 }}
            className={`w-full table-fixed border-separate border-spacing-0 text-sm transition-opacity ${loading ? "opacity-60" : ""}`}
          >
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 w-[120px] min-w-[120px] border-b border-r border-gray-200 bg-gray-50 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Date
                </th>
                {filteredWorkers.map((w) => (
                  <th key={w.id}
                    className="sticky top-0 z-20 border-b border-r border-gray-200 bg-gray-50 px-2.5 py-2 text-left">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[10px] font-semibold text-white">
                        {initials(w.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold capitalize text-gray-800" title={w.name}>{w.name}</div>
                        {w.designation && <div className="truncate text-[10px] font-normal text-gray-400">{w.designation}</div>}
                      </div>
                    </div>
                  </th>
                ))}
                <th className="sticky right-0 top-0 z-30 w-[110px] min-w-[110px] border-b border-l border-gray-200 bg-gray-100 px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                  Day total
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleDates.map((date) => {
                const isToday  = date === todayYMD;
                const d        = fromYMD(date);
                const sunday   = d.getDay() === 0;
                const dayTotal = totals.byDate[date] ?? 0;
                const rowBg    = isToday
                  ? "bg-amber-50 dark:bg-[#1f1a10]"
                  : sunday ? "bg-gray-50" : "bg-white";
                return (
                  <tr key={date} className={rowBg}>
                    <td className={`sticky left-0 z-10 border-b border-r border-gray-200 px-3 py-2 align-top ${rowBg} ${isToday ? "shadow-[inset_3px_0_0_0_var(--color-amber-500)]" : ""}`}>
                      <div className="whitespace-nowrap text-xs font-semibold text-gray-800">{displayDate(date)}</div>
                      {(isToday || totals.countByDate[date]) ? (
                        <div className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
                          {isToday && (
                            <span className="rounded bg-amber-500 px-1 py-px text-[9px] font-bold uppercase leading-none text-white">Today</span>
                          )}
                          {totals.countByDate[date] ? (
                            <span className="text-[10px] text-gray-400">{totals.countByDate[date]} entr{totals.countByDate[date] === 1 ? "y" : "ies"}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </td>

                    {filteredWorkers.map((w) => {
                      const key    = `${date}:${w.id}`;
                      const values = cells[key] ?? [];
                      return (
                        <td key={w.id} className="h-px border-b border-r border-gray-200 p-0 align-top">
                          <CellInput
                            values={values}
                            isSaving={saving.has(key)}
                            onChange={(next) => handleCellValues(date, w.id, next)}
                          />
                        </td>
                      );
                    })}

                    <td className={`sticky right-0 z-10 border-b border-l border-gray-200 px-3 py-2 text-right align-top ${
                      isToday ? "bg-amber-100 dark:bg-[#2a2213]" : "bg-gray-50"
                    }`}>
                      <span className={`text-sm font-semibold tabular-nums ${dayTotal ? "text-gray-900" : "text-gray-300"}`}>
                        {dayTotal ? money(dayTotal) : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {visibleDates.length === 0 && (
                <tr>
                  <td colSpan={filteredWorkers.length + 2} className="px-4 py-10 text-center text-sm text-gray-400">
                    No entries in this range.
                  </td>
                </tr>
              )}
            </tbody>

            {/* Column totals — like the sums at the bottom of each notebook column */}
            <tfoot>
              <tr>
                <td className="sticky bottom-0 left-0 z-30 border-r border-t-2 border-gray-300 bg-gray-100 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-700">
                  Total
                </td>
                {filteredWorkers.map((w) => (
                  <td key={w.id} className="sticky bottom-0 z-20 border-r border-t-2 border-gray-300 bg-gray-100 px-2.5 py-2 text-right">
                    <div className={`text-sm font-bold tabular-nums ${totals.byWorker[w.id] ? "text-gray-900" : "text-gray-300"}`}>
                      {totals.byWorker[w.id] ? money(totals.byWorker[w.id]) : "—"}
                    </div>
                    {totals.countByWorker[w.id] ? (
                      <div className="text-[10px] text-gray-500">{totals.countByWorker[w.id]} entries</div>
                    ) : null}
                  </td>
                ))}
                <td className="sticky bottom-0 right-0 z-30 border-l border-t-2 border-gray-300 bg-gray-900 px-3 py-2 text-right">
                  <div className="text-sm font-bold tabular-nums text-white">{money(totals.grand)}</div>
                  <div className="text-[10px] text-gray-400">{totals.entries} entries</div>
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* ── Status bar ───────────────────────────────────────────────────── */}
      <p className="flex items-center gap-1.5 pb-1 text-xs text-gray-400">
        {saving.size > 0 ? (
          <><Save className="h-3 w-3 animate-pulse text-blue-400" /> Saving {saving.size} cell{saving.size !== 1 ? "s" : ""}…</>
        ) : (
          "All changes saved · Click a cell and type amounts (Enter adds the next one) · Click an entry to edit it"
        )}
      </p>
    </div>
  );
}
