// Server-only — never import from client components.
//
// MODULE : Attendance — PDF export
//
// Follows lib/invoice-pdf.tsx exactly: the same @react-pdf/renderer entry point,
// the same bundled Inter faces (no network fetch at render time) and the same
// `renderToBuffer` contract, so the download route is identical in shape to the
// invoice one that already ships.
//
// Landscape A4, because thirteen columns of attendance do not fit portrait.

import path from "path";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ExportRow } from "@/lib/attendance-export";
import { formatMinutes, type AttendanceSummary } from "@/lib/attendance";

const fontDir = path.join(process.cwd(), "node_modules/@fontsource/inter/files");

// Same family and same files as the invoice renderer. Registration is idempotent —
// whichever module loads first wins and the result is identical either way.
Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(fontDir, "inter-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(fontDir, "inter-latin-700-normal.woff"), fontWeight: 700 },
  ],
});

Font.registerHyphenationCallback((w) => [w]);

const ROSE = "#D4687A";
const ROSE_LIGHT = "#FBE8EC";
const INK = "#2B2B2B";
const MUTED = "#888888";
const RULE = "#E7E7E7";

/** Column widths in points. Sum ≈ 762 = A4 landscape minus 40pt margins. */
const COLS = [
  { key: "date", label: "Date", width: 50, align: "left" },
  { key: "employee", label: "Employee", width: 84, align: "left" },
  { key: "employeeCode", label: "Code", width: 44, align: "left" },
  { key: "branch", label: "Branch", width: 58, align: "left" },
  { key: "shift", label: "Shift", width: 50, align: "left" },
  { key: "checkIn", label: "In", width: 32, align: "center" },
  { key: "checkOut", label: "Out", width: 32, align: "center" },
  { key: "breakMinutes", label: "Break", width: 30, align: "right" },
  { key: "workingHours", label: "Hours", width: 36, align: "right" },
  { key: "lateMinutes", label: "Late", width: 28, align: "right" },
  { key: "overtimeMinutes", label: "OT", width: 28, align: "right" },
  { key: "status", label: "Status", width: 48, align: "left" },
  { key: "entryType", label: "Entry", width: 40, align: "left" },
  { key: "createdBy", label: "Created By", width: 62, align: "left" },
  { key: "reason", label: "Manual Reason", width: 80, align: "left" },
  { key: "markedBy", label: "Marked By", width: 60, align: "left" },
] as const satisfies readonly {
  key: keyof ExportRow;
  label: string;
  width: number;
  align: "left" | "right" | "center";
}[];

const s = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 7.5,
    color: INK,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  title: { fontSize: 15, fontWeight: 700, color: INK, letterSpacing: 1 },
  brand: { fontSize: 7, fontWeight: 700, letterSpacing: 2, color: ROSE, textTransform: "uppercase" },
  meta: { fontSize: 7.5, color: MUTED, marginTop: 2 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8 },

  summaryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: ROSE_LIGHT,
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  summaryItem: { width: "12.5%", paddingRight: 6 },
  summaryLabel: { fontSize: 6, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryValue: { fontSize: 9, fontWeight: 700, color: INK, marginTop: 1 },

  tHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: ROSE,
    paddingBottom: 3,
    marginBottom: 2,
  },
  tHeadCell: { fontSize: 6.5, fontWeight: 700, color: ROSE, textTransform: "uppercase", letterSpacing: 0.3 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingVertical: 2.5,
  },
  cell: { fontSize: 7 },

  footer: {
    position: "absolute",
    bottom: 10,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 6.5,
    color: MUTED,
  },
  empty: { marginTop: 24, textAlign: "center", fontSize: 9, color: MUTED },
});

export type AttendancePdfInput = {
  title: string;
  /** e.g. "01 Aug 2026 → 31 Aug 2026". */
  range: string;
  /** Branch / status / search narrowing, rendered verbatim under the title. */
  filterLine: string;
  generatedAt: string;
  rows: ExportRow[];
  summary: AttendanceSummary;
  /** Set when the row cap trimmed the export, so the page can say so. */
  truncatedNote: string | null;
};

function cellText(row: ExportRow, key: keyof ExportRow): string {
  const value = row[key];
  return typeof value === "number" ? String(value) : String(value ?? "");
}

function AttendanceDocument(input: AttendancePdfInput) {
  const { summary } = input;

  const summaryItems: { label: string; value: string }[] = [
    { label: "Records", value: String(summary.total) },
    { label: "Present", value: String(summary.present) },
    { label: "Late", value: String(summary.late) },
    { label: "Half Day", value: String(summary.halfDay) },
    { label: "Absent", value: String(summary.absent) },
    { label: "On Leave", value: String(summary.onLeave) },
    { label: "Attendance", value: summary.attendancePct === null ? "—" : `${summary.attendancePct}%` },
    { label: "Total Hours", value: formatMinutes(summary.workingMinutes) },
    { label: "Overtime", value: formatMinutes(summary.overtimeMinutes) },
    { label: "Late Minutes", value: String(summary.lateMinutes) },
    { label: "Break", value: formatMinutes(summary.breakMinutes) },
    { label: "Avg Hours/Day", value: formatMinutes(summary.avgWorkingMinutes) },
    { label: "Avg Late", value: `${summary.avgLateMinutes} min` },
    { label: "Holiday", value: String(summary.holiday) },
    { label: "Week Off", value: String(summary.weekOff) },
  ];

  return (
    <Document title={input.title} author="Renzo">
      <Page size="A4" orientation="landscape" style={s.page} wrap>
        <View style={s.headerRow} fixed>
          <View>
            <Text style={s.brand}>Renzo</Text>
            <Text style={s.title}>{input.title}</Text>
            <Text style={s.meta}>{input.range}</Text>
            {input.filterLine ? <Text style={s.meta}>{input.filterLine}</Text> : null}
          </View>
          <Text style={s.meta}>Generated {input.generatedAt}</Text>
        </View>

        <View style={s.summaryWrap}>
          {summaryItems.map((item) => (
            <View key={item.label} style={s.summaryItem}>
              <Text style={s.summaryLabel}>{item.label}</Text>
              <Text style={s.summaryValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {input.truncatedNote ? <Text style={s.meta}>{input.truncatedNote}</Text> : null}

        <View style={s.tHead} fixed>
          {COLS.map((col) => (
            <Text
              key={col.key}
              style={[s.tHeadCell, { width: col.width, textAlign: col.align }]}
            >
              {col.label}
            </Text>
          ))}
        </View>

        {input.rows.length === 0 ? (
          <Text style={s.empty}>No attendance records match these filters.</Text>
        ) : (
          input.rows.map((row, index) => (
            <View key={`${row.date}-${row.employeeCode}-${index}`} style={s.row} wrap={false}>
              {COLS.map((col) => (
                <Text
                  key={col.key}
                  style={[s.cell, { width: col.width, textAlign: col.align }]}
                >
                  {cellText(row, col.key)}
                </Text>
              ))}
            </View>
          ))
        )}

        <View style={s.footer} fixed>
          <Text>Renzo — Attendance Report</Text>
          <Text
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

/** Render the report to a PDF buffer. Mirrors `generateInvoicePdf`'s contract. */
export async function generateAttendancePdf(input: AttendancePdfInput): Promise<Buffer> {
  return renderToBuffer(<AttendanceDocument {...input} />);
}
