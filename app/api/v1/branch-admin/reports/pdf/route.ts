// ============================================================================
// MODULE : Branch Admin Reports — PDF rendering
// ROUTE  : /api/v1/branch-admin/reports/pdf
//
// POST { report, meta }  →  application/pdf (attachment)
//
//      The Sheet and Reports pages build their report tables in the browser
//      (the same model their CSVs use) and post them here to be rendered by
//      @react-pdf — the invoice PDF engine — so downloads are real .pdf files
//      rather than a print dialog. The payload is only ever rendered back to
//      the caller, but it is still validated and size-capped: an unbounded
//      render is the easiest way to exhaust a serverless function.
//
// RUNTIME: Node (react-pdf needs fs for fonts). Fonts ship with the function
//          via outputFileTracingIncludes in next.config.ts.
//
// ACCESS: BRANCH_ADMIN, OWNER, SUPER_ADMIN
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-guard";
import { err } from "@/lib/response";
import { generateReportPdf } from "@/lib/report-pdf";
import { PDF_MAX_ROWS, reportFilename, type Report, type ReportMeta } from "@/lib/report-export";

export const runtime = "nodejs";
export const maxDuration = 60;

const ROLES = ["BRANCH_ADMIN", "OWNER", "SUPER_ADMIN"] as const;
const MAX_BYTES = 4 * 1024 * 1024; // stays under the 4.5 MB serverless body limit

const str = (max: number) => z.string().max(max);
const lineItem = z.object({ label: str(300).nullable(), amount: z.number().finite().nullable(), tag: str(10).nullable() });
const cell = z.union([
  str(2000),
  z.number().finite(),
  z.null(),
  z.object({ lines: z.array(lineItem).max(200), total: z.number().finite() }),
]);
const column = z.object({
  label: str(120),
  kind: z.enum(["text", "money", "int", "pct"]).optional(),
  weight: z.number().min(0.1).max(10).optional(),
});

const schema = z.object({
  report: z.object({
    title: str(120),
    stats: z.array(z.object({ label: str(80), value: str(200) })).max(20),
    tables: z.array(z.object({
      title: str(160),
      note: str(500).optional(),
      csvNote: str(500).optional(),
      columns: z.array(column).min(1).max(30),
      rows: z.array(z.array(cell).max(30)),
      footer: z.array(cell).max(30).optional(),
      itemised: z.boolean().optional(),
    })).max(30),
  }),
  meta: z.object({
    orgName: str(120),
    periodLabel: str(120),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    subtitle: str(120).optional(),
  }),
});

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, ...ROLES);
  if (error) return error;

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) return err("This report is too large for a PDF. Pick a shorter period or use CSV.", 413);

  let body: unknown;
  try { body = await req.json(); } catch { return err("Invalid JSON", 400); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return err("Invalid report payload", 422);

  const report = parsed.data.report as Report;
  const meta = parsed.data.meta as ReportMeta;

  const rows = report.tables.reduce((n, t) => n + t.rows.length, 0);
  if (rows > PDF_MAX_ROWS)
    return err(`This report has ${rows.toLocaleString("en-IN")} rows — too many for a PDF. Pick a shorter period or use CSV.`, 413);

  try {
    const buffer = await generateReportPdf(report, meta);
    // Same name the browser saves it under ("Renzo Main - Daily revenue - 1 Sep
    // 2026 to 30 Sep 2026.pdf"); `filename*` carries it intact, `filename` is
    // the plain-ASCII fallback older clients read.
    const filename = reportFilename(report, meta, "pdf");
    const asciiName = filename.replace(/[^\x20-\x7e]/g, "").replace(/"/g, "");
    // Copy into a view of exactly the PDF's bytes — `buffer.buffer` can be a
    // larger pooled ArrayBuffer.
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[REPORT PDF] Failed:", e);
    return err("Could not create the PDF. Please try again.", 500);
  }
}
