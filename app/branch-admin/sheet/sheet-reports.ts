// ============================================================================
// Sheet reports — builds every downloadable report from the Sheet's cells.
// Rendering to CSV / PDF lives in lib/report-export so all exports look alike.
// ============================================================================

import {
  downloadCSV as saveCSV, downloadPDF as savePDF, inr, money,
  type Cell, type Column, type Kind, type Report, type ReportMeta, type Table,
} from "@/lib/report-export";

export { inr, money };

export interface Worker {
  id: string;
  name: string;
  designation: string | null;
}

// ─── Shared helpers (also used by the Sheet grid) ────────────────────────────

const DAY   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function fromYMD(ymd: string): Date {
  return new Date(ymd + "T00:00:00");
}

export function displayDate(ymd: string): string {
  const d = fromYMD(ymd);
  return `${DAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

function fullDate(ymd: string): string {
  const d = fromYMD(ymd);
  return `${DAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
}

// Cells hold free text. Entries written by bookings look like "Haircut · ₹200";
// entries typed at the desk are usually just "200" or "200P" (like the notebook).
export interface Parsed {
  label:  string | null;
  amount: number | null;
  tag:    string | null;
}

const toNum = (s: string) => Number(s.replace(/,/g, ""));

export function parseEntry(raw: string): Parsed {
  const s = raw.trim();
  const svc = s.match(/^(.*?)\s*·\s*₹\s*([\d,]+(?:\.\d+)?)$/);
  if (svc) return { label: svc[1] || null, amount: toNum(svc[2]), tag: null };

  const plain = s.match(/^₹?\s*([\d,]+(?:\.\d+)?)\s*([A-Za-z]{0,3})$/);
  if (plain) return { label: null, amount: toNum(plain[1]), tag: plain[2] ? plain[2].toUpperCase() : null };

  const trailing = s.match(/^(.*\D)\s+₹?\s*([\d,]+(?:\.\d+)?)$/);
  if (trailing) return { label: trailing[1].trim(), amount: toNum(trailing[2]), tag: null };

  return { label: s, amount: null, tag: null };
}

export function sumEntries(values: string[]): number {
  let total = 0;
  for (const v of values) total += parseEntry(v).amount ?? 0;
  return total;
}


// ─── Report model ─────────────────────────────────────────────────────────────

export type ReportId = "full" | "grid" | "workers" | "daily" | "entries" | "services";

export const REPORT_OPTIONS: { id: ReportId; name: string; description: string }[] = [
  { id: "full",     name: "Full report",       description: "Summary, workers, days, services and every entry" },
  { id: "grid",     name: "Daily sheet",       description: "The sheet itself — workers × days with totals" },
  { id: "workers",  name: "Worker summary",    description: "Earnings, entries, active days and share per worker" },
  { id: "daily",    name: "Day-wise summary",  description: "Total, entries and top worker for each day" },
  { id: "services", name: "Service summary",   description: "How often each service was done and what it earned" },
  { id: "entries",  name: "Detailed entries",  description: "Every line item — date, worker, service, amount" },
];

export interface ReportInput {
  branchName:  string;
  periodLabel: string;
  from:        string;
  to:          string;
  dates:       string[];
  workers:     Worker[];
  cells:       Record<string, string[]>;
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

function aggregate(input: ReportInput) {
  const { dates, workers, cells } = input;
  const byWorker = new Map<string, { total: number; entries: number; days: number }>();
  const byDate   = new Map<string, { total: number; entries: number; workers: number; top: { name: string; total: number } | null }>();
  const services = new Map<string, { count: number; total: number; workers: Set<string> }>();
  const entries: { date: string; worker: Worker; p: Parsed; raw: string }[] = [];
  let grand = 0, count = 0;

  for (const w of workers) byWorker.set(w.id, { total: 0, entries: 0, days: 0 });

  for (const d of dates) {
    const day = { total: 0, entries: 0, workers: 0, top: null as { name: string; total: number } | null };
    for (const w of workers) {
      const vals = cells[`${d}:${w.id}`];
      if (!vals?.length) continue;
      const sum = sumEntries(vals);
      const bw = byWorker.get(w.id)!;
      bw.total += sum; bw.entries += vals.length; bw.days += 1;
      day.total += sum; day.entries += vals.length; day.workers += 1;
      if (!day.top || sum > day.top.total) day.top = { name: w.name, total: sum };
      grand += sum; count += vals.length;

      for (const raw of vals) {
        const p = parseEntry(raw);
        entries.push({ date: d, worker: w, p, raw });
        const key = p.amount === null ? "Notes (no amount)" : p.label ?? "Amount only (no service name)";
        const s = services.get(key) ?? { count: 0, total: 0, workers: new Set<string>() };
        s.count += 1; s.total += p.amount ?? 0; s.workers.add(w.name);
        services.set(key, s);
      }
    }
    byDate.set(d, day);
  }

  const activeDays = [...byDate.values()].filter((d) => d.entries > 0).length;
  const ranked = [...workers].sort((a, b) => byWorker.get(b.id)!.total - byWorker.get(a.id)!.total);
  const top = ranked[0] && byWorker.get(ranked[0].id)!.total > 0 ? ranked[0] : null;
  const bestDay = [...byDate.entries()].reduce<[string, number] | null>(
    (best, [d, v]) => (v.total > (best?.[1] ?? 0) ? [d, v.total] : best), null
  );

  return { byWorker, byDate, services, entries, grand, count, activeDays, ranked, top, bestDay };
}

type Agg = ReturnType<typeof aggregate>;

// ─── Tables ───────────────────────────────────────────────────────────────────

function gridTables(input: ReportInput, agg: Agg): Table[] {
  // Split wide branches across several tables so PDF columns stay readable.
  const PER_TABLE = 7;
  const groups: Worker[][] = [];
  for (let i = 0; i < input.workers.length; i += PER_TABLE) groups.push(input.workers.slice(i, i + PER_TABLE));
  if (groups.length === 0) groups.push([]);

  return groups.map((group, gi) => {
    const last = gi === groups.length - 1;
    const columns: Column[] = [
      { label: "Date" },
      ...group.map((w) => ({ label: w.name, kind: "money" as Kind })),
      ...(last ? [{ label: "Day total", kind: "money" as Kind }] : []),
    ];
    const rows: Cell[][] = input.dates.map((d) => [
      fullDate(d),
      ...group.map((w): Cell => {
        const vals = input.cells[`${d}:${w.id}`] ?? [];
        return vals.length ? { lines: vals.map(parseEntry), total: sumEntries(vals) } : null;
      }),
      ...(last ? [agg.byDate.get(d)?.total || null] : []),
    ]);
    const footer: Cell[] = [
      "Total",
      ...group.map((w) => agg.byWorker.get(w.id)!.total),
      ...(last ? [agg.grand] : []),
    ];
    return {
      title: groups.length > 1
        ? `Daily sheet — workers ${gi * PER_TABLE + 1}–${gi * PER_TABLE + group.length} of ${input.workers.length}`
        : "Daily sheet",
      note: "Each cell lists that worker's entries for the day; the bold figure is their day total.",
      csvNote: "Values are each worker's total for the day — see Detailed entries for line items.",
      columns, rows, footer, itemised: true,
    };
  });
}

function workerTable(input: ReportInput, agg: Agg): Table {
  return {
    title: "Worker summary",
    columns: [
      { label: "#", kind: "int" }, { label: "Worker" }, { label: "Designation" },
      { label: "Entries", kind: "int" }, { label: "Active days", kind: "int" },
      { label: "Avg / active day", kind: "money" }, { label: "Share", kind: "pct" }, { label: "Total", kind: "money" },
    ],
    rows: agg.ranked.map((w, i) => {
      const s = agg.byWorker.get(w.id)!;
      return [
        i + 1, w.name, w.designation ?? "", s.entries, s.days,
        s.days ? Math.round(s.total / s.days) : 0,
        agg.grand ? (s.total / agg.grand) * 100 : 0,
        s.total,
      ];
    }),
    footer: ["", "Total", "", agg.count, agg.activeDays,
      agg.activeDays ? Math.round(agg.grand / agg.activeDays) : 0, agg.grand ? 100 : 0, agg.grand],
  };
}

function dailyTable(input: ReportInput, agg: Agg): Table {
  return {
    title: "Day-wise summary",
    columns: [
      { label: "Date" }, { label: "Entries", kind: "int" }, { label: "Workers active", kind: "int" },
      { label: "Top worker" }, { label: "Top worker amount", kind: "money" }, { label: "Day total", kind: "money" },
    ],
    rows: input.dates.map((d) => {
      const v = agg.byDate.get(d)!;
      return [fullDate(d), v.entries, v.workers, v.top?.name ?? "", v.top?.total ?? null, v.total];
    }),
    footer: ["Total", agg.count, "", "", null, agg.grand],
  };
}

function serviceTable(agg: Agg): Table {
  const rows = [...agg.services.entries()].sort((a, b) => b[1].total - a[1].total);
  return {
    title: "Service summary",
    note: "Entries typed as a bare amount (e.g. \"200P\") are grouped under \"Amount only\".",
    columns: [
      { label: "#", kind: "int" }, { label: "Service", weight: 2 }, { label: "Times done", kind: "int" },
      { label: "Avg price", kind: "money" }, { label: "Done by", weight: 2 }, { label: "Total", kind: "money" },
    ],
    rows: rows.map(([name, s], i) => [
      i + 1, name, s.count, s.count ? Math.round(s.total / s.count) : 0, [...s.workers].join(", "), s.total,
    ]),
    footer: ["", "Total", agg.count, null, "", agg.grand],
  };
}

function entriesTable(agg: Agg): Table {
  return {
    title: "Detailed entries",
    columns: [
      { label: "#", kind: "int" }, { label: "Date" }, { label: "Worker" },
      { label: "Service / note", weight: 2.2 }, { label: "Tag" }, { label: "Amount", kind: "money" },
    ],
    rows: agg.entries.map((e, i) => [
      i + 1, fullDate(e.date), e.worker.name, e.p.label ?? "", e.p.tag ?? "", e.p.amount,
    ]),
    footer: ["", "Total", "", `${agg.count} entries`, "", agg.grand],
  };
}

export function buildReport(id: ReportId, input: ReportInput): Report {
  const agg = aggregate(input);
  const stats = [
    { label: "Total",              value: money(agg.grand) },
    { label: "Entries",            value: inr.format(agg.count) },
    { label: "Active days",        value: `${agg.activeDays} of ${input.dates.length}` },
    { label: "Avg per active day", value: money(agg.activeDays ? Math.round(agg.grand / agg.activeDays) : 0) },
    { label: "Top worker",         value: agg.top ? `${agg.top.name} · ${money(agg.byWorker.get(agg.top.id)!.total)}` : "—" },
    { label: "Best day",           value: agg.bestDay ? `${displayDate(agg.bestDay[0])} · ${money(agg.bestDay[1])}` : "—" },
  ];
  const name = REPORT_OPTIONS.find((o) => o.id === id)!.name;

  switch (id) {
    case "grid":     return { title: name, stats, tables: gridTables(input, agg) };
    case "workers":  return { title: name, stats, tables: [workerTable(input, agg)] };
    case "daily":    return { title: name, stats, tables: [dailyTable(input, agg)] };
    case "services": return { title: name, stats, tables: [serviceTable(agg)] };
    case "entries":  return { title: name, stats, tables: [entriesTable(agg)] };
    case "full":
      return {
        title: name, stats,
        tables: [workerTable(input, agg), dailyTable(input, agg), serviceTable(agg), ...gridTables(input, agg), entriesTable(agg)],
      };
  }
}

// ─── Download ─────────────────────────────────────────────────────────────────

function metaFor(id: ReportId, input: ReportInput): ReportMeta {
  return {
    orgName: input.branchName,
    periodLabel: input.periodLabel,
    from: input.from,
    to: input.to,
    subtitle: `${input.workers.length} worker${input.workers.length === 1 ? "" : "s"}`,
  };
}

export function downloadCSV(id: ReportId, input: ReportInput): void {
  saveCSV(buildReport(id, input), metaFor(id, input));
}

export function downloadPDF(id: ReportId, input: ReportInput): Promise<void> {
  return savePDF(buildReport(id, input), metaFor(id, input));
}
