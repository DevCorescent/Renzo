// ============================================================================
// MODULE : Attendance — export serialisers
//
// CSV and Excel, written by hand and on purpose.
//
// WHY NOT AN XLSX LIBRARY: the project has no spreadsheet dependency, and adding
// one (`xlsx`, `exceljs`) for a download button is a large surface for a small
// feature. SpreadsheetML 2003 is an XML dialect Excel, LibreOffice, Numbers and
// Google Sheets all open natively, and it carries real cell TYPES — so hours land
// as numbers a user can sum, not text. That is a genuine Excel file, not a CSV
// with the extension changed.
//
// Both serialisers take the same flat `ExportRow[]`, so the CSV and the Excel
// sheet can never drift apart in column order or content.
// ============================================================================

import {
  formatDateKey,
  formatLocalTime,
  minutesToHours,
  statusLabel,
} from "@/lib/attendance";
import type { AttendanceRecord } from "@/lib/attendance-service";
import {
  serialiseCsv,
  serialiseExcelXml,
  type ExportColumn,
} from "@/lib/table-export";

/** One spreadsheet line. Mirrors the on-screen table column for column. */
export type ExportRow = {
  date: string;
  employee: string;
  employeeCode: string;
  branch: string;
  shift: string;
  checkIn: string;
  checkOut: string;
  breakMinutes: number;
  workingHours: number;
  lateMinutes: number;
  overtimeMinutes: number;
  overtimeApproved: string;
  status: string;
  entryType: string;
  createdBy: string;
  reason: string;
  approvalStatus: string;
  markedBy: string;
  notes: string;
};

const COLUMNS: ExportColumn<ExportRow>[] = [
  { header: "Date", key: "date", type: "text" },
  { header: "Employee", key: "employee", type: "text" },
  { header: "Employee Code", key: "employeeCode", type: "text" },
  { header: "Branch", key: "branch", type: "text" },
  { header: "Shift", key: "shift", type: "text" },
  { header: "Check In", key: "checkIn", type: "text" },
  { header: "Check Out", key: "checkOut", type: "text" },
  { header: "Break (min)", key: "breakMinutes", type: "number" },
  { header: "Working Hours", key: "workingHours", type: "number" },
  { header: "Late (min)", key: "lateMinutes", type: "number" },
  { header: "Overtime (min)", key: "overtimeMinutes", type: "number" },
  { header: "OT Approved", key: "overtimeApproved", type: "text" },
  { header: "Status", key: "status", type: "text" },
  { header: "Entry Type", key: "entryType", type: "text" },
  { header: "Created By", key: "createdBy", type: "text" },
  { header: "Manual Reason", key: "reason", type: "text" },
  { header: "Approval", key: "approvalStatus", type: "text" },
  { header: "Marked By", key: "markedBy", type: "text" },
  { header: "Notes", key: "notes", type: "text" },
];

export const EXPORT_HEADERS = COLUMNS.map((c) => c.header);

/** Flatten a stored record into its export line. The single mapping, shared by all three formats. */
export function toExportRow(
  record: AttendanceRecord & {
    markedByName?: string | null;
    manualCreatedByName?: string | null;
    approvedByName?: string | null;
  }
): ExportRow {
  const worker = record.worker;

  return {
    date: formatDateKey(record.date),
    employee: worker.displayName?.trim() || `${worker.firstName} ${worker.lastName}`.trim(),
    employeeCode: worker.employeeCode,
    branch: record.branch.name,
    shift: record.shift?.name ?? "—",
    checkIn: formatLocalTime(record.checkIn),
    checkOut: formatLocalTime(record.checkOut),
    breakMinutes: record.breakMinutes,
    workingHours: minutesToHours(record.workingMinutes),
    lateMinutes: record.lateMinutes,
    overtimeMinutes: record.overtimeMinutes,
    overtimeApproved: record.overtimeMinutes > 0 ? (record.overtimeApproved ? "Yes" : "No") : "—",
    status: statusLabel(record.status),
    entryType: record.isManual ? "Manual" : "Automatic",
    createdBy: record.isManual
      ? record.manualCreatedByName ?? record.markedByName ?? "—"
      : "—",
    reason: record.manualReason ?? "",
    // Only a manual row has an approval state to report; an automatic one was
    // never pending anything.
    approvalStatus: record.isManual
      ? record.approvedAt
        ? `Approved${record.approvedByName ? ` by ${record.approvedByName}` : ""}`
        : "Pending"
      : "—",
    markedBy: record.markedByName ?? (record.markedBy ? "—" : "Self"),
    notes: record.notes ?? "",
  };
}

// ============================================================================
// SERIALISERS
//
// The mechanics — RFC 4180 quoting, the UTF-8 BOM, XML escaping, real numeric
// cells — live in lib/table-export.ts and are shared with the customer exports.
// Only the column spec above is attendance-specific. These wrappers keep the
// original signatures, so the export route did not have to change.
// ============================================================================

export function toCsv(rows: ExportRow[]): string {
  return serialiseCsv(COLUMNS, rows);
}

export function toExcelXml(rows: ExportRow[], sheetName = "Attendance"): string {
  return serialiseExcelXml(COLUMNS, rows, sheetName);
}

// ============================================================================
// FILENAMES
// ============================================================================

/** `Attendance-2026-08-01_to_2026-08-31.csv` — safe on every filesystem. */
export function exportFilename(
  extension: "csv" | "xls" | "pdf",
  from: Date | null,
  to: Date | null
): string {
  const range =
    from && to
      ? formatDateKey(from) === formatDateKey(to)
        ? formatDateKey(from)
        : `${formatDateKey(from)}_to_${formatDateKey(to)}`
      : from
      ? `from-${formatDateKey(from)}`
      : to
      ? `to-${formatDateKey(to)}`
      : "all";

  return `Attendance-${range}.${extension}`;
}
