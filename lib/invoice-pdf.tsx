// Server-only — never import from client components.
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

Font.registerHyphenationCallback((w) => [w]);

// ── Palette — elegant rose / blush matching reference ──
const ROSE       = "#D4687A";   // accent / headers
const ROSE_LIGHT = "#FBE8EC";   // table header bg, total row bg
const ROSE_MID   = "#F2D0D8";   // decorative circle fills
const INK        = "#2B2B2B";
const MUTED      = "#888888";
const RULE       = "#EED8DC";
const WHITE      = "#FFFFFF";

const s = StyleSheet.create({
  page: {
    fontFamily: "Inter", fontSize: 10, color: INK,
    backgroundColor: WHITE, paddingHorizontal: 52, paddingVertical: 44,
  },

  /* ── decorative circles (top-right & bottom-left) ────────── */
  decCircleTR: {
    position: "absolute", top: -30, right: -30,
    width: 150, height: 150, borderRadius: 75,
    backgroundColor: ROSE_MID, opacity: 0.45,
  },
  decCircleBL: {
    position: "absolute", bottom: -20, left: -20,
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: ROSE_MID, opacity: 0.35,
  },

  /* ── logo block (centered) ───────────────────────────────── */
  logoWrap:    { alignItems: "center", marginBottom: 8 },
  logoCircle:  {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1.5, borderColor: ROSE,
    alignItems: "center", justifyContent: "center",
    marginBottom: 6,
  },
  logoInitial: { fontSize: 18, fontWeight: 700, color: ROSE },
  brandName:   { fontSize: 9, fontWeight: 700, letterSpacing: 3, color: INK, textTransform: "uppercase" },
  tagline:     { fontSize: 7, color: MUTED, letterSpacing: 2, marginTop: 2, textTransform: "uppercase" },

  /* ── "INVOICE" title ─────────────────────────────────────── */
  invoiceTitle: {
    fontSize: 34, fontWeight: 700, color: INK,
    letterSpacing: 6, textAlign: "center", marginBottom: 4,
  },

  /* ── thin decorative rule ────────────────────────────────── */
  ruleWrap:    { marginVertical: 14 },
  ruleLine:    { height: 1, backgroundColor: RULE },

  /* ── info columns: INVOICE TO / INVOICE NO. / DATE ─────── */
  infoRow:     { flexDirection: "row", justifyContent: "space-between", marginBottom: 22 },
  infoBlock:   { flex: 1 },
  infoBlockR:  { flex: 1, alignItems: "flex-end" },
  infoLbl:     { fontSize: 7.5, fontWeight: 700, color: MUTED, letterSpacing: 1.5, marginBottom: 4, textTransform: "uppercase" },
  infoVal:     { fontSize: 11, fontWeight: 700, color: INK },
  infoSub:     { fontSize: 9, color: MUTED, marginTop: 2 },

  /* ── table ───────────────────────────────────────────────── */
  thRow:  {
    flexDirection: "row",
    backgroundColor: ROSE_LIGHT,
    paddingVertical: 7, paddingHorizontal: 10,
  },
  th:      { fontSize: 7.5, fontWeight: 700, color: ROSE, letterSpacing: 1.2, textTransform: "uppercase" },
  tdRow:   {
    flexDirection: "row",
    paddingVertical: 9, paddingHorizontal: 10,
    borderBottomWidth: 1, borderBottomColor: RULE,
  },
  tdLast:  { borderBottomWidth: 0 },

  /* column widths */
  colDesc: { flex: 1 },
  colQty:  { width: 36, textAlign: "center" },
  colRate: { width: 72, textAlign: "right" },
  colAmt:  { width: 72, textAlign: "right" },

  tdText:  { fontSize: 9.5, color: INK },
  tdMuted: { fontSize: 9.5, color: MUTED },

  /* ── totals block ────────────────────────────────────────── */
  totWrap: { marginTop: 14, marginLeft: "auto", width: 210 },
  tRow:    { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  tLbl:    { fontSize: 9.5, color: MUTED },
  tVal:    { fontSize: 9.5, color: INK },
  tGreen:  { fontSize: 9.5, color: "#15803d" },

  /* highlighted total row */
  grandRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 8, paddingHorizontal: 8,
    backgroundColor: ROSE_LIGHT, marginTop: 4,
  },
  grandLbl: { fontSize: 11, fontWeight: 700, color: ROSE },
  grandVal: { fontSize: 11, fontWeight: 700, color: ROSE },

  paidRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  paidLbl: { fontSize: 9, color: "#15803d" },
  paidVal: { fontSize: 9, fontWeight: 700, color: "#15803d" },

  balRow:  { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  balLbl:  { fontSize: 9, fontWeight: 700, color: "#dc2626" },
  balVal:  { fontSize: 9, fontWeight: 700, color: "#dc2626" },

  /* ── footer ──────────────────────────────────────────────── */
  footerRule:  { height: 1, backgroundColor: RULE, marginTop: 28, marginBottom: 16 },
  footerRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  thankYou:    { fontSize: 22, fontWeight: 700, color: ROSE, letterSpacing: 1 },
  ftBrand:     { fontSize: 8, fontWeight: 700, color: INK, letterSpacing: 1, marginBottom: 2 },
  ftContact:   { fontSize: 7.5, color: MUTED, marginTop: 1 },
  ftRight:     { alignItems: "flex-end" },
  ftWebsite:   { fontSize: 7.5, color: MUTED },
});

export type InvoicePdfData = {
  invoiceNo: string;
  date: string;
  branch: string;
  customerName: string;
  customerPhone?: string;
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
    <Document title={`Invoice ${d.invoiceNo} — Renzo`} author="Renzo Salon">
      <Page size="A4" style={s.page}>

        {/* Decorative background circles */}
        <View style={s.decCircleTR} fixed />
        <View style={s.decCircleBL} fixed />

        {/* Centered logo + brand */}
        <View style={s.logoWrap}>
          <View style={s.logoCircle}>
            <Text style={s.logoInitial}>R</Text>
          </View>
          <Text style={s.brandName}>Renzo</Text>
          <Text style={s.tagline}>Hair &amp; Beauty Salon</Text>
        </View>

        {/* "INVOICE" heading */}
        <Text style={s.invoiceTitle}>INVOICE</Text>

        {/* Thin rule */}
        <View style={s.ruleWrap}>
          <View style={s.ruleLine} />
        </View>

        {/* INVOICE TO / INVOICE NO. / DATE */}
        <View style={s.infoRow}>
          <View style={s.infoBlock}>
            <Text style={s.infoLbl}>Invoice To</Text>
            <Text style={s.infoVal}>{d.customerName}</Text>
            {d.customerPhone && <Text style={s.infoSub}>{d.customerPhone}</Text>}
          </View>
          <View style={s.infoBlockR}>
            <Text style={s.infoLbl}>Invoice No.</Text>
            <Text style={s.infoVal}>{d.invoiceNo}</Text>
            <Text style={[s.infoLbl, { marginTop: 8 }]}>Date</Text>
            <Text style={s.infoVal}>{d.date}</Text>
          </View>
        </View>

        {/* Table header */}
        <View style={s.thRow}>
          <Text style={[s.th, s.colDesc]}>Description</Text>
          <Text style={[s.th, s.colQty]}>Qty</Text>
          <Text style={[s.th, s.colRate]}>Rate</Text>
          <Text style={[s.th, s.colAmt]}>Amount</Text>
        </View>

        {/* Table rows */}
        {d.items.map((item, i) => (
          <View key={i} style={[s.tdRow, i === d.items.length - 1 ? s.tdLast : {}]}>
            <Text style={[s.tdText, s.colDesc]}>{item.label}</Text>
            <Text style={[s.tdMuted, s.colQty]}>1</Text>
            <Text style={[s.tdMuted, s.colRate]}>{inr(item.amount)}</Text>
            <Text style={[s.tdText, s.colAmt]}>{inr(item.amount)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={s.totWrap}>
          <View style={s.tRow}>
            <Text style={s.tLbl}>Sub-Total</Text>
            <Text style={s.tVal}>{inr(d.subtotal)}</Text>
          </View>
          {d.discount > 0 && (
            <View style={s.tRow}>
              <Text style={s.tLbl}>Discount</Text>
              <Text style={s.tGreen}>– {inr(d.discount)}</Text>
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
        <View style={s.footerRule} />
        <View style={s.footerRow}>
          <View>
            <Text style={s.thankYou}>Thank You!</Text>
            <Text style={[s.ftBrand, { marginTop: 6 }]}>Renzo Hair &amp; Beauty Salon</Text>
            <Text style={s.ftContact}>{d.branch}</Text>
          </View>
          <View style={s.ftRight}>
            <Text style={s.ftWebsite}>renzosalon.com</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDoc d={data} />);
}
