"use client";

import * as React from "react";
import { Download, FileText, Filter, RotateCcw, Save, Plus, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Worker {
  id: string;
  name: string;
  designation: string | null;
}

interface SheetLog {
  date: string;
  cells: Record<string, string[]>;
}

interface Props {
  initialWorkers: Worker[];
}

type DateRange = "today" | "week" | "month" | "custom";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
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

const DAY   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function displayDate(ymd: string): string {
  const d = new Date(ymd + "T00:00:00");
  return `${DAY[d.getDay()]}, ${MONTH[d.getMonth()]} ${d.getDate()}`;
}

function rangeForPreset(preset: DateRange, cf: string, ct: string): [string, string] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (preset === "today") return [toYMD(today), toYMD(today)];
  if (preset === "week") {
    const sw = startOfISOWeek(today);
    return [toYMD(sw), toYMD(addDays(sw, 6))];
  }
  if (preset === "month") {
    return [
      toYMD(new Date(today.getFullYear(), today.getMonth(), 1)),
      toYMD(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    ];
  }
  return [cf, ct];
}

// ─── CellInput — multi-tag input for one worker/day cell ─────────────────────

function CellInput({
  values,
  isSaving,
  onChange,
}: {
  values: string[];
  isSaving: boolean;
  onChange: (next: string[]) => void;
}) {
  const [draft,   setDraft]   = React.useState("");
  const [editing, setEditing] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function openEditor() {
    setEditing(true);
    // Focus in next tick after the input is mounted
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function commit() {
    const v = draft.trim();
    if (v) onChange([...values, v]);
    setDraft("");
    setEditing(false);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter")  { e.preventDefault(); commit(); }
    if (e.key === "Escape") { setDraft(""); setEditing(false); }
  }

  function remove(i: number) {
    onChange(values.filter((_, idx) => idx !== i));
  }

  const isEmpty = values.length === 0;

  return (
    <div
      className={`
        group relative min-h-[40px] px-2 py-1.5
        flex flex-wrap content-start gap-1 items-start
        transition-colors
        ${editing ? "bg-blue-50/70 dark:bg-blue-900/20 ring-2 ring-inset ring-blue-400/60" : "hover:bg-gray-50 dark:hover:bg-white/5"}
      `}
    >
      {/* Existing tags */}
      {values.map((v, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 dark:text-gray-300 max-w-full"
        >
          <span className="truncate max-w-[110px]" title={v}>{v}</span>
          <button
            type="button"
            onClick={() => remove(i)}
            className="shrink-0 text-gray-400 hover:text-red-500 transition-colors"
            aria-label={`Remove ${v}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}

      {/* Inline add-input or trigger */}
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={commit}
          placeholder="type & Enter…"
          className="min-w-[90px] max-w-full flex-1 rounded border border-blue-300 bg-white dark:bg-gray-900 dark:border-blue-500 px-1.5 py-0.5 text-xs text-gray-700 dark:text-gray-300 focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={openEditor}
          className={`
            inline-flex items-center gap-0.5 rounded border border-dashed
            px-1.5 py-0.5 text-[10px] transition-colors
            ${isEmpty
              ? "border-gray-200 dark:border-white/10 text-gray-300 dark:text-white/20 group-hover:border-gray-400 group-hover:text-gray-400"
              : "border-gray-300 dark:border-white/20 text-gray-400 hover:border-gray-500 hover:text-gray-600 dark:text-white/30 dark:hover:text-white/50"
            }
          `}
          aria-label="Add service"
        >
          <Plus className="h-2.5 w-2.5" />
          {isEmpty ? "add" : "more"}
        </button>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <span className="absolute right-1 top-1 pointer-events-none">
          <Save className="h-2.5 w-2.5 text-blue-400 animate-pulse" />
        </span>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SheetClient({ initialWorkers }: Props) {
  const todayYMD = toYMD(new Date());

  const [workers, setWorkers] = React.useState<Worker[]>(initialWorkers);
  // cells: key = "YYYY-MM-DD:workerId", value = string[]
  const [cells, setCells] = React.useState<Record<string, string[]>>({});

  const [preset,     setPreset]     = React.useState<DateRange>("week");
  const [customFrom, setCustomFrom] = React.useState(todayYMD);
  const [customTo,   setCustomTo]   = React.useState(todayYMD);

  const [from, to] = rangeForPreset(preset, customFrom, customTo);

  const dates = React.useMemo(() => {
    try { return eachDay(new Date(from + "T00:00:00"), new Date(to + "T00:00:00")).map(toYMD); }
    catch { return []; }
  }, [from, to]);

  const [loading, setLoading] = React.useState(false);
  const [saving,  setSaving]  = React.useState<Set<string>>(new Set());
  const [filter,  setFilter]  = React.useState("");

  const debounceRef = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
    setLoading(true);
    try {
      const res  = await fetch(`/api/v1/branch-admin/sheet?from=${from}&to=${to}`);
      const json = await res.json();
      if (!json.success) return;

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
      setLoading(false);
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

  // ── CSV export ────────────────────────────────────────────────────────────
  function exportCSV() {
    const header = ["Date", ...filteredWorkers.map((w) => w.name)];
    const rows   = dates.map((d) => [
      displayDate(d),
      ...filteredWorkers.map((w) => (cells[`${d}:${w.id}`] ?? []).join(" + ")),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sheet-${from}-to-${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // ── PDF export (print) ───────────────────────────────────────────────────
  function exportPDF() {
    const styleId = "__sheet-print-style";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) { style = document.createElement("style"); style.id = styleId; document.head.appendChild(style); }
    style.textContent = `
      @media print {
        body > *:not(#__sheet-print-root) { display: none !important; }
        #__sheet-print-root { display: block !important; }
        @page { size: landscape; margin: 10mm; }
      }
    `;

    const existing = document.getElementById("__sheet-print-root");
    if (existing) document.body.removeChild(existing);
    const root  = document.createElement("div");
    root.id     = "__sheet-print-root";
    root.style.display = "none";

    const table = document.createElement("table");
    table.style.cssText = "width:100%;border-collapse:collapse;font-size:10px;font-family:sans-serif";

    const thead = document.createElement("thead");
    const hr    = document.createElement("tr");
    ["Date", ...filteredWorkers.map((w) => w.name)].forEach((h) => {
      const th = document.createElement("th");
      th.textContent = h;
      th.style.cssText = "border:1px solid #ccc;padding:4px 6px;background:#f3f4f6;text-align:left;white-space:nowrap";
      hr.appendChild(th);
    });
    thead.appendChild(hr); table.appendChild(thead);

    const tbody = document.createElement("tbody");
    dates.forEach((d) => {
      const tr = document.createElement("tr");
      [displayDate(d), ...filteredWorkers.map((w) => (cells[`${d}:${w.id}`] ?? []).join("\n"))].forEach((v) => {
        const td = document.createElement("td");
        td.style.cssText = "border:1px solid #ccc;padding:4px 6px;vertical-align:top;white-space:pre-line";
        td.textContent = v;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    root.appendChild(table);
    document.body.appendChild(root);
    window.print();
    setTimeout(() => { const r = document.getElementById("__sheet-print-root"); if (r) document.body.removeChild(r); }, 500);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const totalEntries = Object.values(cells).reduce((n, arr) => n + arr.length, 0);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sheet</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {filteredWorkers.length} worker{filteredWorkers.length !== 1 ? "s" : ""}
            {" · "}{dates.length} day{dates.length !== 1 ? "s" : ""}
            {totalEntries > 0 && ` · ${totalEntries} entr${totalEntries !== 1 ? "ies" : "y"}`}
          </p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Presets */}
          {(["today","week","month","custom"] as DateRange[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium border transition-colors ${
                preset === p
                  ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700"
              }`}
            >
              {p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : "Custom"}
            </button>
          ))}

          {/* Custom pickers */}
          {preset === "custom" && (
            <>
              <input type="date" value={customFrom} max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-2 py-1.5 text-gray-700 dark:text-gray-300" />
              <span className="text-gray-400 text-sm">→</span>
              <input type="date" value={customTo} min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm px-2 py-1.5 text-gray-700 dark:text-gray-300" />
            </>
          )}

          {/* Filter */}
          <div className="relative">
            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter workers…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm pl-7 pr-3 py-1.5 text-gray-700 dark:text-gray-300 w-40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            />
          </div>

          {/* Refresh */}
          <button onClick={fetchData} disabled={loading}
            className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1.5 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-40"
            title="Refresh">
            <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {/* CSV */}
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <Download className="h-3.5 w-3.5" /> CSV
          </button>

          {/* PDF */}
          <button onClick={exportPDF}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            <FileText className="h-3.5 w-3.5" /> PDF
          </button>
        </div>
      </div>

      {/* ── Sheet Table ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
        ) : filteredWorkers.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">No workers found.</div>
        ) : (
          <table className="min-w-max w-full border-collapse text-sm">
            <thead>
              <tr>
                {/* Corner — sticky left + sticky top */}
                <th className="sticky left-0 top-0 z-30 bg-gray-50 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap min-w-[140px]">
                  Date
                </th>
                {filteredWorkers.map((w) => (
                  <th key={w.id}
                    className="sticky top-0 z-20 bg-gray-50 dark:bg-gray-800 border-b border-r border-gray-200 dark:border-gray-700 px-3 py-3 text-left whitespace-nowrap min-w-[180px]">
                    <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">{w.name}</div>
                    {w.designation && <div className="text-[10px] font-normal text-gray-400 dark:text-gray-500 mt-0.5">{w.designation}</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((date, di) => (
                <tr key={date} className={di % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50/60 dark:bg-gray-800/40"}>
                  {/* Sticky date column */}
                  <td className="sticky left-0 z-10 bg-inherit border-b border-r border-gray-200 dark:border-gray-700 px-4 py-2 whitespace-nowrap align-top">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">{displayDate(date)}</div>
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">{date}</div>
                  </td>

                  {/* Worker cells */}
                  {filteredWorkers.map((w) => {
                    const key    = `${date}:${w.id}`;
                    const values = cells[key] ?? [];
                    return (
                      <td key={w.id} className="border-b border-r border-gray-200 dark:border-gray-700 p-0 align-top">
                        <CellInput
                          values={values}
                          isSaving={saving.has(key)}
                          onChange={(next) => handleCellValues(date, w.id, next)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Status bar ───────────────────────────────────────────────────── */}
      <p className="text-xs text-gray-400 dark:text-gray-500 pb-1 flex items-center gap-1.5">
        {saving.size > 0 ? (
          <><Save className="h-3 w-3 animate-pulse text-blue-400" /> Saving {saving.size} cell{saving.size !== 1 ? "s" : ""}…</>
        ) : (
          "All changes saved · Click any cell to add services · Press Enter to add, × to remove"
        )}
      </p>
    </div>
  );
}
