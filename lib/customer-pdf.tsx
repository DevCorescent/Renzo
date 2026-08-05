// Server-only — never import from client components.
//
// MODULE : Customers — PDF export
//
// Same shape as lib/attendance-pdf.tsx: the same @react-pdf/renderer entry point,
// the same bundled Inter faces (no network fetch at render time) and the same
// `renderToBuffer` contract, so the two download routes stay symmetrical.
//
// Landscape A4, because the customer sheet is wider than portrait allows.

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
import type { CustomerExportRow } from "@/lib/customer-export";

const fontDir = path.join(process.cwd(), "node_modules/@fontsource/inter/files");

// Registration is idempotent — whichever PDF module loads first wins and the
// result is identical either way.
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

/** Column widths in points. Sum = 762 = A4 landscape minus 40pt margins. */
const COLS = [
  { key: "name", label: "Name", width: 88, align: "left" },
  { key: "phone", label: "Phone", width: 68, align: "left" },
  { key: "email", label: "Email", width: 96, align: "left" },
  { key: "gender", label: "Gender", width: 36, align: "left" },
  { key: "age", label: "Age", width: 24, align: "right" },
  { key: "city", label: "City", width: 54, align: "left" },
  { key: "branch", label: "Branch", width: 62, align: "left" },
  { key: "customerType", label: "Type", width: 48, align: "left" },
  { key: "source", label: "Source", width: 48, align: "left" },
  { key: "entryType", label: "Entry", width: 40, align: "left" },
  { key: "membership", label: "Membership", width: 70, align: "left" },
  { key: "visits", label: "Visits", width: 28, align: "right" },
  { key: "totalSpend", label: "Spend", width: 44, align: "right" },
  { key: "createdAt", label: "Created", width: 56, align: "left" },
] as const satisfies readonly {
  key: keyof CustomerExportRow;
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 8,
  },

  summaryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: ROSE_LIGHT,
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  summaryItem: { width: "20%", paddingRight: 6 },
  summaryLabel: { fontSize: 6, color: MUTED, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryValue: { fontSize: 9, fontWeight: 700, color: INK, marginTop: 1 },

  tHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: ROSE,
    paddingBottom: 3,
    marginBottom: 2,
  },
  tHeadCell: {
    fontSize: 6.5,
    fontWeight: 700,
    color: ROSE,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
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

export type CustomerPdfInput = {
  rows: CustomerExportRow[];
  branchLabel: string;
  generatedAt: Date;
  truncated: boolean;
};

function cellText(row: CustomerExportRow, key: keyof CustomerExportRow): string {
  const value = row[key];
  if (typeof value === "number") {
    // Spend reads as currency; counts stay bare.
    return key === "totalSpend" ? `₹${value.toLocaleString("en-IN")}` : String(value);
  }
  return String(value ?? "");
}

function CustomerDocument(input: CustomerPdfInput) {
  const { rows } = input;

  const manual = rows.filter((r) => r.entryType === "Manual").length;
  const withMembership = rows.filter((r) => r.membership !== "").length;
  const totalSpend = rows.reduce((sum, r) => sum + r.totalSpend, 0);
  const totalVisits = rows.reduce((sum, r) => sum + r.visits, 0);

  const summaryItems = [
    { label: "Customers", value: String(rows.length) },
    { label: "Manual Entries", value: String(manual) },
    { label: "With Membership", value: String(withMembership) },
    { label: "Total Visits", value: String(totalVisits) },
    { label: "Total Spend", value: `₹${totalSpend.toLocaleString("en-IN")}` },
  ];

  const generated = input.generatedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  return (
    <Document title="Renzo — Customers" author="Renzo">
      <Page size="A4" orientation="landscape" style={s.page} wrap>
        <View style={s.headerRow} fixed>
          <View>
            <Text style={s.brand}>Renzo</Text>
            <Text style={s.title}>Customers</Text>
            <Text style={s.meta}>{input.branchLabel}</Text>
          </View>
          <Text style={s.meta}>Generated {generated}</Text>
        </View>

        <View style={s.summaryWrap}>
          {summaryItems.map((item) => (
            <View key={item.label} style={s.summaryItem}>
              <Text style={s.summaryLabel}>{item.label}</Text>
              <Text style={s.summaryValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        {input.truncated ? (
          <Text style={s.meta}>
            Showing the first {rows.length} customers — narrow the filters to export the rest.
          </Text>
        ) : null}

        <View style={s.tHead} fixed>
          {COLS.map((col) => (
            <Text key={col.key} style={[s.tHeadCell, { width: col.width, textAlign: col.align }]}>
              {col.label}
            </Text>
          ))}
        </View>

        {rows.length === 0 ? (
          <Text style={s.empty}>No customers match these filters.</Text>
        ) : (
          rows.map((row, index) => (
            <View key={`${row.phone}-${index}`} style={s.row} wrap={false}>
              {COLS.map((col) => (
                <Text key={col.key} style={[s.cell, { width: col.width, textAlign: col.align }]}>
                  {cellText(row, col.key)}
                </Text>
              ))}
            </View>
          ))
        )}

        <View style={s.footer} fixed>
          <Text>Renzo — Customer List</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

/** Render the customer list to a PDF buffer. Mirrors `generateAttendancePdf`. */
export async function generateCustomerPdf(input: CustomerPdfInput): Promise<Buffer> {
  return renderToBuffer(<CustomerDocument {...input} />);
}
