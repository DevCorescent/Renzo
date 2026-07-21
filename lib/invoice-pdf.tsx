// Server-only — never import from client components.
import React from "react";
import path from "path";
import { Document, Page, View, Text, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";

const fontDir = path.join(process.cwd(), "node_modules/@fontsource/inter/files");
Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(fontDir, "inter-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(fontDir, "inter-latin-700-normal.woff"), fontWeight: 700 },
  ],
});

// Prevent widow words inside Text elements.
Font.registerHyphenationCallback((w) => [w]);

const GOLD  = "#C8A96A";
const INK   = "#18181b";
const MUTED = "#71717a";
const RULE  = "#e4e4e7";
const PALE  = "#fafaf9";

const s = StyleSheet.create({
  page: {
    fontFamily: "Inter", fontSize: 10, color: INK,
    backgroundColor: "#ffffff", padding: "44 52 52 52",
  },

  /* ── header ─────────────────────────────────────────────── */
  hdr:     { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  logo:    { fontSize: 20, fontWeight: 700, letterSpacing: 3, color: INK },
  tagline: { fontSize: 7.5, color: MUTED, letterSpacing: 2, marginTop: 4, textTransform: "uppercase" },
  rhs:     { alignItems: "flex-end" },
  invLbl:  { fontSize: 16, fontWeight: 700, color: GOLD, letterSpacing: 5 },
  invNo:   { fontSize: 10, fontWeight: 700, marginTop: 4 },
  invDate: { fontSize: 9, color: MUTED, marginTop: 2 },

  /* ── gold rule ───────────────────────────────────────────── */
  goldRule: { height: 1.5, backgroundColor: GOLD, marginBottom: 24 },

  /* ── bill-to / branch ────────────────────────────────────── */
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },
  infoLbl: { fontSize: 7.5, fontWeight: 700, color: MUTED, letterSpacing: 1.5, marginBottom: 5, textTransform: "uppercase" },
  infoVal: { fontSize: 12, fontWeight: 700 },
  infoR:   { alignItems: "flex-end" },

  /* ── items table ─────────────────────────────────────────── */
  thRow:   { flexDirection: "row", backgroundColor: PALE, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 4, marginBottom: 2 },
  th:      { fontSize: 7.5, fontWeight: 700, color: MUTED, letterSpacing: 1.5 },
  tdRow:   { flexDirection: "row", paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: RULE },
  tdLast:  { borderBottomWidth: 0 },
  tdDesc:  { flex: 1, fontSize: 10, color: INK },
  tdAmt:   { width: 80, textAlign: "right", fontSize: 10, color: INK },

  /* ── totals ──────────────────────────────────────────────── */
  totWrap:   { marginTop: 16, marginLeft: "auto", width: 220 },
  thinRule:  { height: 1, backgroundColor: RULE, marginBottom: 8 },
  tRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3.5 },
  tLbl:      { fontSize: 10, color: MUTED },
  tVal:      { fontSize: 10, color: INK },
  tDiscount: { fontSize: 10, color: "#16a34a" },
  grandRow:  { flexDirection: "row", justifyContent: "space-between", paddingVertical: 9, borderTopWidth: 2, borderTopColor: GOLD, marginTop: 4 },
  grandLbl:  { fontSize: 12, fontWeight: 700 },
  grandVal:  { fontSize: 13, fontWeight: 700, color: GOLD },
  paidRow:   { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3.5 },
  paidLbl:   { fontSize: 10, color: "#16a34a" },
  paidVal:   { fontSize: 10, fontWeight: 700, color: "#16a34a" },
  balRow:    { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3.5 },
  balLbl:    { fontSize: 10, fontWeight: 700, color: "#dc2626" },
  balVal:    { fontSize: 10, fontWeight: 700, color: "#dc2626" },

  /* ── footer ──────────────────────────────────────────────── */
  footer:   { marginTop: "auto", paddingTop: 20, borderTopWidth: 1, borderTopColor: RULE, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ftNote:   { fontSize: 8, color: MUTED },
  ftBrand:  { fontSize: 8, fontWeight: 700, color: GOLD, letterSpacing: 2 },
});

export type InvoicePdfData = {
  invoiceNo: string;
  date: string;
  branch: string;
  customerName: string;
  items: { label: string; amount: number }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
  method: string;
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function InvoiceDoc({ d }: { d: InvoicePdfData }) {
  return (
    <Document title={`Invoice ${d.invoiceNo} — Renzo Salon`} author="Renzo Salon">
      <Page size="A4" style={s.page}>

        {/* Header */}
        <View style={s.hdr}>
          <View>
            <Text style={s.logo}>RENZO</Text>
            <Text style={s.tagline}>Premium Salon & Spa</Text>
          </View>
          <View style={s.rhs}>
            <Text style={s.invLbl}>INVOICE</Text>
            <Text style={s.invNo}>{d.invoiceNo}</Text>
            <Text style={s.invDate}>{d.date}</Text>
          </View>
        </View>

        <View style={s.goldRule} />

        {/* Bill-to / Branch */}
        <View style={s.infoRow}>
          <View>
            <Text style={s.infoLbl}>Billed To</Text>
            <Text style={s.infoVal}>{d.customerName}</Text>
          </View>
          <View style={s.infoR}>
            <Text style={s.infoLbl}>Branch</Text>
            <Text style={s.infoVal}>{d.branch}</Text>
          </View>
        </View>

        {/* Items */}
        <View style={s.thRow}>
          <Text style={[s.th, { flex: 1 }]}>Description</Text>
          <Text style={[s.th, { width: 80, textAlign: "right" }]}>Amount</Text>
        </View>

        {d.items.map((item, i) => (
          <View key={i} style={[s.tdRow, i === d.items.length - 1 ? s.tdLast : {}]}>
            <Text style={s.tdDesc}>{item.label}</Text>
            <Text style={s.tdAmt}>{inr(item.amount)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={s.totWrap}>
          <View style={s.thinRule} />
          <View style={s.tRow}>
            <Text style={s.tLbl}>Subtotal</Text>
            <Text style={s.tVal}>{inr(d.subtotal)}</Text>
          </View>
          {d.discount > 0 && (
            <View style={s.tRow}>
              <Text style={s.tLbl}>Discount</Text>
              <Text style={s.tDiscount}>– {inr(d.discount)}</Text>
            </View>
          )}
          {d.tax > 0 && (
            <View style={s.tRow}>
              <Text style={s.tLbl}>Tax</Text>
              <Text style={s.tVal}>{inr(d.tax)}</Text>
            </View>
          )}
          <View style={s.grandRow}>
            <Text style={s.grandLbl}>Total</Text>
            <Text style={s.grandVal}>{inr(d.total)}</Text>
          </View>
          <View style={s.paidRow}>
            <Text style={s.paidLbl}>Paid via {d.method}</Text>
            <Text style={s.paidVal}>{inr(d.paid)}</Text>
          </View>
          {d.balance > 0 && (
            <View style={s.balRow}>
              <Text style={s.balLbl}>Balance Due</Text>
              <Text style={s.balVal}>{inr(d.balance)}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.ftNote}>Thank you for choosing Renzo Salon. We look forward to seeing you again!</Text>
          <Text style={s.ftBrand}>RENZO</Text>
        </View>

      </Page>
    </Document>
  );
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDoc d={data} />);
}
