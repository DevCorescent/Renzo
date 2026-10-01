// Server-only — never import from client components.
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { PDF_FONT } from "@/lib/pdf-fonts";
import { taxLabel } from "@/lib/invoice-breakdown";

// ── Palette — gold / beige "Tax Invoice / Bill" sheet ──
const GOLD       = "#A8862B";   // brand name, rules
const BEIGE      = "#F0E9D8";   // table header
const BEIGE_SOFT = "#F7F2E6";   // grand-total bar
const INK        = "#1F1F1F";
const MUTED      = "#6B6B6B";
const LINE       = "#CFCFCF";   // box / table borders
const WHITE      = "#FFFFFF";

const s = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT, fontSize: 9.5, color: INK,
    backgroundColor: WHITE, paddingHorizontal: 40, paddingTop: 44, paddingBottom: 40,
  },

  /* ── brand block (centered) ──────────────────────────────── */
  brandWrap: { alignItems: "center" },
  brandName: { fontSize: 24, fontWeight: 700, color: GOLD, letterSpacing: 0.5, textTransform: "uppercase" },
  brandSub:  { fontSize: 10, color: MUTED, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.5 },
  brandLine: { fontSize: 9, color: MUTED, marginTop: 2 },
  goldRule:  { height: 1, backgroundColor: GOLD, marginTop: 10 },

  /* ── title ───────────────────────────────────────────────── */
  title: { fontSize: 15, fontWeight: 700, textAlign: "center", marginTop: 16, marginBottom: 12 },

  /* ── 3 × 2 details box ───────────────────────────────────── */
  box:      { borderWidth: 1, borderColor: LINE },
  boxRow:   { flexDirection: "row" },
  boxRowTop:{ borderTopWidth: 1, borderTopColor: LINE },
  cell:     { flex: 1, paddingVertical: 7, paddingHorizontal: 8 },
  cellMid:  { borderLeftWidth: 1, borderRightWidth: 1, borderColor: LINE },
  cellLbl:  { fontSize: 8.5, fontWeight: 700, marginBottom: 2 },
  cellVal:  { fontSize: 8.5, color: INK },

  /* ── services table ──────────────────────────────────────── */
  table:   { borderWidth: 1, borderColor: LINE, marginTop: 14 },
  thRow:   { flexDirection: "row", backgroundColor: BEIGE },
  tdRow:   { flexDirection: "row", borderTopWidth: 1, borderTopColor: LINE },
  th:      { fontSize: 8.5, fontWeight: 700, paddingVertical: 7, paddingHorizontal: 8 },
  td:      { fontSize: 8.5, paddingVertical: 8, paddingHorizontal: 8 },
  tdStaff: { fontSize: 7.5, color: MUTED, marginTop: 2 },
  colNo:   { width: 32 },
  colSvc:  { flex: 1, borderLeftWidth: 1, borderLeftColor: LINE },
  colQty:  { width: 48, textAlign: "right", borderLeftWidth: 1, borderLeftColor: LINE },
  colRate: { width: 96, textAlign: "right", borderLeftWidth: 1, borderLeftColor: LINE },
  colAmt:  { width: 104, textAlign: "right", borderLeftWidth: 1, borderLeftColor: LINE },

  /* ── totals (right) ──────────────────────────────────────── */
  totWrap:  { marginTop: 12, marginLeft: "auto", width: 260 },
  tRow:     { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 4 },
  tLbl:     { fontSize: 8.5, textAlign: "right", flex: 1, paddingRight: 24 },
  tLblBold: { fontSize: 8.5, fontWeight: 700, textAlign: "right", flex: 1, paddingRight: 24 },
  tVal:     { fontSize: 8.5, textAlign: "right", width: 90, paddingRight: 8 },
  tValBold: { fontSize: 8.5, fontWeight: 700, textAlign: "right", width: 90, paddingRight: 8 },
  grandRow: {
    flexDirection: "row", justifyContent: "flex-end", paddingVertical: 6, marginTop: 4,
    borderTopWidth: 1, borderTopColor: GOLD, backgroundColor: BEIGE_SOFT,
  },
  paidVal:  { color: "#15803d" },
  dueVal:   { color: "#dc2626" },

  /* ── footer ──────────────────────────────────────────────── */
  footer:     { marginTop: 28, paddingTop: 12, borderTopWidth: 1, borderTopColor: LINE, alignItems: "center" },
  ftNote:     { fontSize: 10, fontWeight: 700, color: GOLD, marginBottom: 4, textAlign: "center" },
  ftLine:     { fontSize: 7.5, color: MUTED, marginTop: 1, textAlign: "center" },
});

export type InvoicePdfData = {
  invoiceNo: string;
  date: string;
  /** "28 Sep 2026 • 11:40 AM" for the A4 Date & Time box; falls back to `date`. */
  dateTime?: string;
  branch: string;
  customerName: string;
  customerPhone?: string;
  /** Who performed the services — the A4 "Staff" box. */
  staff?: string;
  /**
   * `label` + `amount` are what every layout prints. `name`/`quantity`/`rate`
   * fill the A4 Qty and Rate columns; without them a line prints as ×1 at its
   * amount, as it always did.
   */
  items: {
    label: string;
    amount: number;
    name?: string;
    quantity?: number;
    rate?: number;
    /** Who performed this line — "Farhan, Riyaz" (two people) or "Farhan" (one). */
    staff?: string;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  /** GST rate actually charged, e.g. 18 — printed as "GST @ 18%". */
  taxPercent?: number;
  /** A tip, added after GST and never discounted. */
  tip?: number;
  total: number;
  paid: number;
  balance: number;
  /** Per-method payment breakdown. Replaces the old single `method` string. */
  payments?: { method: string; amount: number }[];
  /** Money handed back (refund route, or a corrected discount) — `paid` is already net of it. */
  refunds?: { method: string; amount: number }[];
  // Invoice display fields — configured once per branch in Branch Settings.
  // All optional; renderers fall back to hardcoded defaults when absent.
  businessName?: string;   // header brand name
  tagline?: string;        // header tagline
  address?: string;        // footer address line
  phone?: string;          // footer contact phone
  email?: string;          // footer contact email
  website?: string;        // footer website
  footerNote?: string;     // footer closing note
  taxName?: string;        // label for the tax line (e.g., "GST")
  taxNumber?: string;      // GST / tax registration number
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** "98XXXXXX21" — a 10-digit mobile with only the first and last two digits shown. */
function maskMobile(phone?: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (local.length < 6) return local || "—";
  return `${local.slice(0, 2)}${"X".repeat(local.length - 4)}${local.slice(-2)}`;
}

/** "UPI / Paid", "Cash + UPI / Partly paid", "— / Unpaid". */
function paymentSummary(d: InvoicePdfData): string {
  const methods = [...new Set((d.payments ?? []).map((p) => p.method))].join(" + ");
  const state = d.balance <= 0 && d.total > 0 ? "Paid" : d.paid > 0 ? "Partly paid" : "Unpaid";
  return `${methods || "—"} / ${state}`;
}

function InvoiceDoc({ d }: { d: InvoicePdfData }) {
  const bizName = d.businessName || "Renzo";
  const contact = [d.address, d.phone, d.email, d.website].filter(Boolean).join("  •  ");
  return (
    <Document title={`Invoice ${d.invoiceNo} — ${bizName}`} author={bizName}>
      <Page size="A4" style={s.page}>

        {/* Brand */}
        <View style={s.brandWrap}>
          <Text style={s.brandName}>{bizName}</Text>
          <Text style={s.brandSub}>{d.tagline || "Hair & Beauty Studio"}</Text>
          <Text style={s.brandLine}>Professional Salon • Hair • Beauty • Grooming</Text>
        </View>
        <View style={s.goldRule} />

        <Text style={s.title}>TAX INVOICE / BILL</Text>

        {/* Details: 3 × 2 */}
        <View style={s.box}>
          <View style={s.boxRow}>
            <View style={s.cell}>
              <Text style={s.cellLbl}>Invoice No.</Text>
              <Text style={s.cellVal}>{d.invoiceNo}</Text>
            </View>
            <View style={[s.cell, s.cellMid]}>
              <Text style={s.cellLbl}>Date &amp; Time</Text>
              <Text style={s.cellVal}>{d.dateTime || d.date}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.cellLbl}>Payment</Text>
              <Text style={s.cellVal}>{paymentSummary(d)}</Text>
            </View>
          </View>
          <View style={[s.boxRow, s.boxRowTop]}>
            <View style={s.cell}>
              <Text style={s.cellLbl}>Customer Name</Text>
              <Text style={s.cellVal}>{d.customerName}</Text>
            </View>
            <View style={[s.cell, s.cellMid]}>
              <Text style={s.cellLbl}>Mobile</Text>
              <Text style={s.cellVal}>{maskMobile(d.customerPhone)}</Text>
            </View>
            <View style={s.cell}>
              <Text style={s.cellLbl}>Staff</Text>
              <Text style={s.cellVal}>{d.staff || "—"}</Text>
            </View>
          </View>
        </View>

        {/* Services */}
        <View style={s.table}>
          <View style={s.thRow}>
            <Text style={[s.th, s.colNo]}>#</Text>
            <Text style={[s.th, s.colSvc]}>Service</Text>
            <Text style={[s.th, s.colQty]}>Qty</Text>
            <Text style={[s.th, s.colRate]}>Rate</Text>
            <Text style={[s.th, s.colAmt]}>Amount</Text>
          </View>
          {d.items.map((item, i) => (
            <View key={i} style={s.tdRow} wrap={false}>
              <Text style={[s.td, s.colNo]}>{i + 1}</Text>
              <View style={[s.td, s.colSvc]}>
                <Text>{item.name ?? item.label}</Text>
                {item.staff ? <Text style={s.tdStaff}>By {item.staff}</Text> : null}
              </View>
              <Text style={[s.td, s.colQty]}>{item.quantity ?? 1}</Text>
              <Text style={[s.td, s.colRate]}>{inr(item.rate ?? item.amount)}</Text>
              <Text style={[s.td, s.colAmt]}>{inr(item.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={s.totWrap} wrap={false}>
          <View style={s.tRow}>
            <Text style={s.tLblBold}>Subtotal</Text>
            <Text style={s.tValBold}>{inr(d.subtotal)}</Text>
          </View>
          {/* Same order the bill was calculated in: discount first, GST on the rest. */}
          {/* Always printed, ₹0 when nothing applies, so every bill shows the same steps. */}
          <View style={s.tRow}>
            <Text style={s.tLbl}>Discount</Text>
            <Text style={s.tVal}>{d.discount > 0 ? `− ${inr(d.discount)}` : inr(0)}</Text>
          </View>
          <View style={s.tRow}>
            <Text style={s.tLbl}>Taxable amount</Text>
            <Text style={s.tVal}>{inr(d.subtotal - d.discount)}</Text>
          </View>
          <View style={s.tRow}>
            <Text style={s.tLbl}>{taxLabel(d.taxName, d.taxPercent ?? 0)}</Text>
            <Text style={s.tVal}>{d.tax > 0 ? `+ ${inr(d.tax)}` : inr(0)}</Text>
          </View>
          {(d.tip ?? 0) > 0 && (
            <View style={s.tRow}>
              <Text style={s.tLbl}>Tip</Text>
              <Text style={s.tVal}>+ {inr(d.tip!)}</Text>
            </View>
          )}
          {(() => {
            const roundOff = d.total - (d.subtotal - d.discount + d.tax + (d.tip ?? 0));
            return Math.abs(roundOff) >= 0.5 ? (
              <View style={s.tRow}>
                <Text style={s.tLbl}>Round off</Text>
                <Text style={s.tVal}>{roundOff > 0 ? "+" : "−"} {inr(Math.abs(roundOff))}</Text>
              </View>
            ) : null;
          })()}
          <View style={s.grandRow}>
            <Text style={s.tLblBold}>Grand Total</Text>
            <Text style={s.tValBold}>{inr(d.total)}</Text>
          </View>
          {(d.refunds ?? []).length > 0 ? (
            // `paid` is net of refunds: show what was collected, what went back, and the net.
            <>
              <View style={s.tRow}>
                <Text style={s.tLbl}>Amount Collected</Text>
                <Text style={s.tVal}>{inr(d.paid + d.refunds!.reduce((sum, r) => sum + r.amount, 0))}</Text>
              </View>
              {d.refunds!.map((r, i) => (
                <View key={`r${i}`} style={s.tRow}>
                  <Text style={s.tLbl}>Refunded ({r.method})</Text>
                  <Text style={s.tVal}>− {inr(r.amount)}</Text>
                </View>
              ))}
              <View style={s.tRow}>
                <Text style={s.tLblBold}>Net Paid</Text>
                <Text style={[s.tValBold, s.paidVal]}>{inr(d.paid)}</Text>
              </View>
            </>
          ) : (
            <View style={s.tRow}>
              <Text style={s.tLbl}>Amount Paid</Text>
              <Text style={[s.tVal, s.paidVal]}>{inr(d.paid)}</Text>
            </View>
          )}
          {d.balance > 0 && (
            <View style={s.tRow}>
              <Text style={s.tLblBold}>Balance Due</Text>
              <Text style={[s.tValBold, s.dueVal]}>{inr(d.balance)}</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={s.footer} wrap={false}>
          <Text style={s.ftNote}>{d.footerNote || "Thank you for visiting!"}</Text>
          {d.branch ? <Text style={s.ftLine}>{d.branch}</Text> : null}
          {contact ? <Text style={s.ftLine}>{contact}</Text> : null}
          {d.taxNumber ? <Text style={s.ftLine}>{d.taxName || "GST"}IN: {d.taxNumber}</Text> : null}
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
      fontFamily: PDF_FONT,
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
    staff: { fontSize: font - 1, color: MUTED, marginTop: -1, marginBottom: 2 },
    total: { fontSize: font + 2, fontWeight: 700 },
    footer: { fontSize: font - 1, textAlign: "center", color: MUTED, marginTop: 4 },
  });
}

function ThermalDoc({ d, kind }: { d: InvoicePdfData; kind: "THERMAL_80" | "THERMAL_58" }) {
  const t = thermalStyles(kind);
  const { width } = ROLL[kind];

  const bizName = (d.businessName || "RENZO").toUpperCase();
  return (
    <Document title={`Invoice ${d.invoiceNo} — ${bizName}`} author={bizName}>
      {/* Height grows with the content: a roll has no page break. */}
      <Page size={{ width, height: 400 + d.items.length * 14 + d.items.filter((i) => i.staff).length * 9 }} style={t.page}>
        <Text style={t.brand}>{bizName}</Text>
        <Text style={t.tagline}>{d.tagline || "Hair & Beauty Salon"}</Text>
        {d.branch ? <Text style={t.meta}>{d.branch}</Text> : null}
        {d.address ? <Text style={t.meta}>{d.address}</Text> : null}
        {d.phone ? <Text style={t.meta}>{d.phone}</Text> : null}

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
          <View key={`${item.label}-${i}`}>
            <View style={t.row}>
              <Text style={t.itemName}>{item.label}</Text>
              <Text style={t.amount}>{inr(item.amount)}</Text>
            </View>
            {item.staff ? <Text style={t.staff}>by {item.staff}</Text> : null}
          </View>
        ))}

        <View style={t.hr} />

        <View style={t.row}>
          <Text>Subtotal</Text>
          <Text style={t.amount}>{inr(d.subtotal)}</Text>
        </View>
        <View style={t.row}>
          <Text>Discount</Text>
          <Text style={t.amount}>{d.discount > 0 ? `- ${inr(d.discount)}` : inr(0)}</Text>
        </View>
        <View style={t.row}>
          <Text>{taxLabel(d.taxName, d.taxPercent ?? 0)}</Text>
          <Text style={t.amount}>{inr(d.tax)}</Text>
        </View>

        <View style={t.hr} />

        <View style={t.row}>
          <Text style={t.total}>TOTAL</Text>
          <Text style={[t.total, t.amount]}>{inr(d.total)}</Text>
        </View>

        {(d.payments && d.payments.length > 0) ? (
          d.payments.map((p, i) => (
            <View key={i} style={t.row}>
              <Text>Paid ({p.method})</Text>
              <Text style={t.amount}>{inr(p.amount)}</Text>
            </View>
          ))
        ) : d.paid > 0 ? (
          <View style={t.row}>
            <Text>Paid</Text>
            <Text style={t.amount}>{inr(d.paid)}</Text>
          </View>
        ) : null}
        {(d.refunds ?? []).map((r, i) => (
          <View key={`r${i}`} style={t.row}>
            <Text>Refunded ({r.method})</Text>
            <Text style={t.amount}>− {inr(r.amount)}</Text>
          </View>
        ))}
        {d.balance > 0 ? (
          <View style={t.row}>
            <Text style={t.bold}>Balance Due</Text>
            <Text style={[t.bold, t.amount]}>{inr(d.balance)}</Text>
          </View>
        ) : null}

        <View style={t.hr} />
        {d.taxNumber ? <Text style={t.footer}>GST: {d.taxNumber}</Text> : null}
        <Text style={t.footer}>{d.footerNote || "Thank you for visiting!"}</Text>
        <Text style={t.footer}>{d.website || "renzosalon.com"}</Text>
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
