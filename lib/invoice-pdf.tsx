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

// ============================================================================
// THERMAL RECEIPT — 80mm and 58mm rolls
//
// A SECOND LAYOUT, not a second document: it renders the same InvoicePdfData the
// A4 invoice does, so the two can never disagree about what was charged. It has
// to be separate because the A4 design is a decorative two-column sheet, and
// neither the decoration nor the columns survive being squeezed onto 58mm of
// paper — a till receipt is a single narrow column by nature.
//
// Widths are the printable area of the roll, not the roll itself: an 80mm roll
// prints ~72mm, a 58mm roll ~48mm. Points = mm × 2.835.
// ============================================================================

export type PrintFormat = "A4" | "THERMAL_80" | "THERMAL_58";

const MM = 2.835;
const ROLL: Record<"THERMAL_80" | "THERMAL_58", { width: number; font: number; pad: number }> = {
  THERMAL_80: { width: 72 * MM, font: 8, pad: 6 },
  THERMAL_58: { width: 48 * MM, font: 6.5, pad: 4 },
};

function thermalStyles(kind: "THERMAL_80" | "THERMAL_58") {
  const { font, pad } = ROLL[kind];
  return StyleSheet.create({
    page: {
      fontFamily: "Inter",
      fontSize: font,
      color: "#000000",
      backgroundColor: WHITE,
      paddingHorizontal: pad,
      paddingVertical: pad + 2,
    },
    center: { textAlign: "center" },
    brand: { fontSize: font + 4, fontWeight: 700, textAlign: "center" },
    tagline: { fontSize: font - 1, textAlign: "center", color: MUTED, marginBottom: 3 },
    meta: { fontSize: font - 0.5, textAlign: "center", color: MUTED },
    hr: { borderBottomWidth: 0.5, borderBottomColor: "#000000", marginVertical: 3 },
    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 },
    // Wraps rather than truncating: a receipt has room below, never beside.
    itemName: { flex: 1, paddingRight: 3 },
    amount: { minWidth: 38, textAlign: "right" },
    bold: { fontWeight: 700 },
    total: { fontSize: font + 2, fontWeight: 700 },
    footer: { fontSize: font - 1, textAlign: "center", color: MUTED, marginTop: 4 },
  });
}

function ThermalDoc({ d, kind }: { d: InvoicePdfData; kind: "THERMAL_80" | "THERMAL_58" }) {
  const t = thermalStyles(kind);
  const { width } = ROLL[kind];

  return (
    <Document title={`Invoice ${d.invoiceNo} — Renzo`} author="Renzo Salon">
      {/* Height grows with the content: a roll has no page break. */}
      <Page size={{ width, height: 400 + d.items.length * 14 }} style={t.page}>
        <Text style={t.brand}>RENZO</Text>
        <Text style={t.tagline}>Hair &amp; Beauty Salon</Text>
        {d.branch ? <Text style={t.meta}>{d.branch}</Text> : null}

        <View style={t.hr} />

        <View style={t.row}>
          <Text>Invoice</Text>
          <Text style={t.bold}>{d.invoiceNo}</Text>
        </View>
        <View style={t.row}>
          <Text>Date</Text>
          <Text>{d.date}</Text>
        </View>
        <View style={t.row}>
          <Text>Customer</Text>
          <Text>{d.customerName}</Text>
        </View>
        {d.customerPhone ? (
          <View style={t.row}>
            <Text>Phone</Text>
            <Text>{d.customerPhone}</Text>
          </View>
        ) : null}

        <View style={t.hr} />

        {d.items.map((item, i) => (
          <View key={`${item.label}-${i}`} style={t.row}>
            <Text style={t.itemName}>{item.label}</Text>
            <Text style={t.amount}>{inr(item.amount)}</Text>
          </View>
        ))}

        <View style={t.hr} />

        <View style={t.row}>
          <Text>Subtotal</Text>
          <Text style={t.amount}>{inr(d.subtotal)}</Text>
        </View>
        {d.discount > 0 ? (
          <View style={t.row}>
            <Text>Discount</Text>
            <Text style={t.amount}>- {inr(d.discount)}</Text>
          </View>
        ) : null}
        {d.tax > 0 ? (
          <View style={t.row}>
            <Text>Tax</Text>
            <Text style={t.amount}>{inr(d.tax)}</Text>
          </View>
        ) : null}

        <View style={t.hr} />

        <View style={t.row}>
          <Text style={t.total}>TOTAL</Text>
          <Text style={[t.total, t.amount]}>{inr(d.total)}</Text>
        </View>

        {d.paid > 0 ? (
          <View style={t.row}>
            <Text>Paid{d.method ? ` (${d.method})` : ""}</Text>
            <Text style={t.amount}>{inr(d.paid)}</Text>
          </View>
        ) : null}
        {d.balance > 0 ? (
          <View style={t.row}>
            <Text style={t.bold}>Balance Due</Text>
            <Text style={[t.bold, t.amount]}>{inr(d.balance)}</Text>
          </View>
        ) : null}

        <View style={t.hr} />
        <Text style={t.footer}>Thank you for visiting!</Text>
        <Text style={t.footer}>renzosalon.com</Text>
      </Page>
    </Document>
  );
}

/**
 * Render the invoice.
 *
 * `format` defaults to A4 so every existing caller keeps its current output
 * without change; the branch's own `BranchSetting.printFormat` drives the till.
 */
export async function generateInvoicePdf(
  data: InvoicePdfData,
  format: PrintFormat = "A4"
): Promise<Buffer> {
  if (format === "THERMAL_80" || format === "THERMAL_58") {
    return renderToBuffer(<ThermalDoc d={data} kind={format} />);
  }
  return renderToBuffer(<InvoiceDoc d={data} />);
}
