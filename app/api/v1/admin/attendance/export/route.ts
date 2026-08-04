// ============================================================================
// MODULE : Attendance Management (admin)
// ROUTE  : /api/v1/admin/attendance/export
//
// METHOD
//   GET — Download the CURRENT filtered view as ?format=csv | excel | pdf.
//
// Reuses the identical filter + branch-scope pipeline as the list endpoint, so a
// download always contains exactly the rows on screen — never "everything",
// which is how an export quietly leaks another branch's data.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN.
//
// FORMATS
//   csv   — UTF-8 with BOM, RFC 4180 quoted (opens clean in Excel on Windows).
//   excel — SpreadsheetML 2003; numeric columns are real numbers, so AutoSum works.
//   pdf   — landscape A4 via @react-pdf/renderer, same engine as the invoice PDF.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import prisma from "@/lib/db";
import {
  attendanceDateKey,
  formatDateKey,
  statusLabel,
  summarizeAttendance,
} from "@/lib/attendance";
import {
  ATTENDANCE_SELECT,
  attendanceOrderBy,
  buildAttendanceWhere,
  monthBounds,
  parseAttendanceFilters,
} from "@/lib/attendance-service";
import { withMarkedByNames } from "@/lib/attendance-api";
import { exportFilename, toCsv, toExcelXml, toExportRow } from "@/lib/attendance-export";
import { generateAttendancePdf } from "@/lib/attendance-pdf";

const FORMATS = ["csv", "excel", "pdf"] as const;
type Format = (typeof FORMATS)[number];

/**
 * Hard row ceilings per format.
 *
 * A PDF is paginated and rendered — 5,000 rows is already ~120 pages and several
 * seconds of CPU. CSV and Excel are linear string building and can take far more.
 * Whatever the cap trims is REPORTED in the file itself and in a response header,
 * never silently dropped.
 */
const MAX_ROWS: Record<Format, number> = { csv: 50_000, excel: 50_000, pdf: 5_000 };

const CONTENT_TYPE: Record<Format, string> = {
  csv: "text/csv; charset=utf-8",
  excel: "application/vnd.ms-excel; charset=utf-8",
  pdf: "application/pdf",
};

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const url = new URL(req.url);
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  try {
    const formatRaw = (url.searchParams.get("format")?.trim().toLowerCase() ?? "csv") as Format;
    if (!FORMATS.includes(formatRaw)) {
      return err("Validation failed", 422, { format: ["Must be csv, excel or pdf"] });
    }

    const parsed = parseAttendanceFilters(url);
    const fallback = monthBounds(attendanceDateKey());
    const filters = {
      ...parsed,
      from: parsed.from ?? fallback.start,
      to: parsed.to ?? fallback.end,
    };

    const where = buildAttendanceWhere(filters, scope);
    const cap = MAX_ROWS[formatRaw];

    const records = await prisma.attendance.findMany({
      where,
      orderBy: attendanceOrderBy(filters),
      take: cap + 1,
      select: ATTENDANCE_SELECT,
    });

    const truncated = records.length > cap;
    const page = truncated ? records.slice(0, cap) : records;

    // Same enricher the table and the detail view use, so "Created By" in a CSV
    // always reads exactly as it does on screen.
    const rows = (await withMarkedByNames(page)).map(toExportRow);

    const filename = exportFilename(
      formatRaw === "excel" ? "xls" : formatRaw,
      filters.from,
      filters.to
    );

    const headers: Record<string, string> = {
      "Content-Type": CONTENT_TYPE[formatRaw],
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Total-Rows": String(page.length),
      ...(truncated ? { "X-Truncated": "true" } : {}),
    };

    if (formatRaw === "pdf") {
      const branchLabel = scope.branchId
        ? (await prisma.branch.findUnique({
            where: { id: scope.branchId },
            select: { name: true },
          }))?.name ?? "Selected branch"
        : "All branches";

      const filterBits = [
        `Branch: ${branchLabel}`,
        filters.status ? `Status: ${statusLabel(filters.status)}` : null,
        filters.lateOnly ? "Late only" : null,
        filters.overtimeOnly ? "Overtime only" : null,
        filters.search ? `Search: ${filters.search}` : null,
      ].filter(Boolean) as string[];

      const buffer = await generateAttendancePdf({
        title: "Attendance Report",
        range: `${formatDateKey(filters.from)}  →  ${formatDateKey(filters.to)}`,
        filterLine: filterBits.join("   ·   "),
        generatedAt: new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "Asia/Kolkata",
        }).format(new Date()),
        rows,
        summary: summarizeAttendance(page),
        truncatedNote: truncated
          ? `Showing the first ${cap.toLocaleString("en-IN")} records. Narrow the date range to export the rest.`
          : null,
      });

      return new NextResponse(buffer.buffer as ArrayBuffer, {
        status: 200,
        headers: { ...headers, "Content-Length": String(buffer.length) },
      });
    }

    const body = formatRaw === "csv" ? toCsv(rows) : toExcelXml(rows);
    return new NextResponse(body, { status: 200, headers });
  } catch (e) {
    console.error("[ATTENDANCE EXPORT] Failed:", e);
    return err("Failed to generate export", 500);
  }
}
