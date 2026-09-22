// ============================================================================
// Report export — one table model, two outputs.
//
//   CSV : Excel-friendly. Title block, raw numbers (so Excel can sum/sort),
//         UTF-8 BOM (so ₹ and – survive), CRLF line endings.
//   PDF : rendered on the server by lib/report-pdf.tsx (@react-pdf, the same
//         engine and fonts as invoices) via POST /api/v1/branch-admin/reports/pdf,
//         then saved as a real .pdf file — no print dialog, works on serverless.
//
// Used by the branch Sheet and the Reports page so every download looks alike.
// The download helpers touch document/Blob, so call them from client code; the
// types and number formatters are safe to import on the server.
// ============================================================================

export type Kind = "text" | "money" | "int" | "pct";

export interface Column {
  label: string;
  kind?: Kind;
  /** PDF only: relative column width, for wide free-text columns. */
  weight?: number;
}

/** A cell holding several line items plus their subtotal (the Sheet grid). */
export interface LinesCell {
  lines: { label: string | null; amount: number | null; tag: string | null }[];
  total: number;
}

export type Cell = string | number | null | LinesCell;

export interface Table {
  title:    string;
  /** Shown under the title in the PDF. */
  note?:    string;
  /** Shown above the header row in the CSV. */
  csvNote?: string;
  columns:  Column[];
  rows:     Cell[][];
  footer?:  Cell[];
  /** Render LinesCell values item by item (PDF); CSV always uses the total. */
  itemised?: boolean;
}

export interface Report {
  title:     string;
  stats:     { label: string; value: string }[];
  tables:    Table[];
}

export interface ReportMeta {
  orgName:     string;   // e.g. branch name
  periodLabel: string;   // "September 2026"
  from:        string;   // YYYY-MM-DD
  to:          string;
  subtitle?:   string;   // "8 workers"
}

export const inr   = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
export const money = (n: number) => `₹${inr.format(n)}`;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** "2026-09-01" → "1 Sep 2026" */
function fileDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * Download name: "<branch> - <report> - <date or date range>.<ext>", e.g.
 * "Renzo Main - Daily revenue - 1 Sep 2026 to 30 Sep 2026.pdf". Characters
 * Windows forbids in file names are dropped.
 */
export function reportFilename(r: Pick<Report, "title">, meta: ReportMeta, ext: "csv" | "pdf"): string {
  const dates = meta.from === meta.to ? fileDate(meta.from) : `${fileDate(meta.from)} to ${fileDate(meta.to)}`;
  const name = [meta.orgName, r.title, dates].join(" - ").replace(/[\\/:*?"<>|\x00-\x1f]+/g, " ").replace(/\s+/g, " ").trim();
  return `${name}.${ext}`;
}

const isLines = (c: Cell): c is LinesCell => typeof c === "object" && c !== null;
const round2  = (n: number) => Math.round(n * 100) / 100;
const generatedAt = () => new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

// ─── CSV ──────────────────────────────────────────────────────────────────────

function csvValue(c: Cell, kind: Kind | undefined): string | number {
  if (c === null || c === "") return "";
  if (isLines(c)) return round2(c.total);
  if (typeof c === "number") return kind === "pct" ? Math.round(c * 10) / 10 : round2(c);
  return c;
}

function csvLine(values: (string | number)[]): string {
  return values
    .map((v) => (typeof v === "number" ? String(v) : `"${v.replace(/"/g, '""')}"`))
    .join(",");
}

export function reportToCSV(r: Report, meta: ReportMeta): string {
  const lines: string[] = [
    csvLine([`${meta.orgName} — ${r.title}`]),
    csvLine(["Period", meta.periodLabel]),
    csvLine(["Generated", generatedAt()]),
    csvLine(["Amounts in", "INR (₹)"]),
    "",
  ];
  if (r.tables.length > 1 && r.stats.length) {
    for (const s of r.stats) lines.push(csvLine([s.label, s.value]));
    lines.push("");
  }
  for (const t of r.tables) {
    if (r.tables.length > 1) lines.push(csvLine([t.title.toUpperCase()]));
    if (t.csvNote) lines.push(csvLine([t.csvNote]));
    lines.push(csvLine(t.columns.map((c) => (c.kind === "pct" ? `${c.label} (%)` : c.label))));
    for (const row of t.rows) lines.push(csvLine(row.map((c, i) => csvValue(c, t.columns[i]?.kind))));
    if (t.footer) lines.push(csvLine(t.footer.map((c, i) => csvValue(c, t.columns[i]?.kind))));
    lines.push("", "");
  }
  return "﻿" + lines.join("\r\n"); // BOM: Excel reads the file as UTF-8
}

// ─── Download triggers ────────────────────────────────────────────────────────

export function downloadCSV(r: Report, meta: ReportMeta): void {
  const blob = new Blob([reportToCSV(r, meta)], { type: "text/csv;charset=utf-8;" });
  saveBlob(blob, reportFilename(r, meta, "csv"));
}

/** Hard ceiling on rows sent for one PDF; the server enforces the same. */
export const PDF_MAX_ROWS = 5000;

export async function downloadPDF(r: Report, meta: ReportMeta): Promise<void> {
  const rows = r.tables.reduce((n, t) => n + t.rows.length, 0);
  if (rows > PDF_MAX_ROWS)
    throw new Error(`This report has ${rows.toLocaleString("en-IN")} rows — too many for a PDF. Pick a shorter period or use CSV.`);

  const res = await fetch("/api/v1/branch-admin/reports/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report: r, meta }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.message ?? "Could not create the PDF. Please try again.");
  }
  saveBlob(await res.blob(), reportFilename(r, meta, "pdf"));
}

function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
