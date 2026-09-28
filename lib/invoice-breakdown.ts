// ============================================================================
// MODULE : Invoices — the printed money breakdown
//
// Turns a saved invoice's stored figures back into the steps the bill was
// calculated in (lib/billing-service.ts → computeInvoiceTotals):
//
//   Subtotal  −  Discount  =  Taxable amount
//   Taxable amount × GST %  =  GST
//   Taxable + GST + Tip + Round-off  =  Total
//
// Every figure comes from the invoice itself — the GST rate is derived from the
// GST actually charged, not today's branch setting — so an old bill still reads
// correctly after the branch changes its rate. Pure: no database, safe anywhere.
// ============================================================================

const round2 = (n: number) => Math.round(n * 100) / 100;

export type InvoiceBreakdown = {
  subtotal: number;
  discount: number;
  /** Subtotal after discount — what GST is charged on. */
  taxable: number;
  tax: number;
  /** Rate actually applied, e.g. 18 — 0 when no GST was charged. */
  taxPercent: number;
  tip: number;
  /** Whatever the operator rounded by (+/−); 0 when none. */
  roundOff: number;
  total: number;
};

export function invoiceBreakdown(invoice: {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  items?: { type: string; total: number }[];
}): InvoiceBreakdown {
  const subtotal = round2(Number(invoice.subtotal));
  const discount = round2(Number(invoice.discountAmount));
  const tax = round2(Number(invoice.taxAmount));
  const total = round2(Number(invoice.totalAmount));
  const taxable = round2(Math.max(0, subtotal - discount));
  // A tip is its own invoice line, added after tax and never discounted.
  const tip = round2((invoice.items ?? []).filter((i) => i.type === "TIP").reduce((s, i) => s + Number(i.total), 0));
  const roundOff = round2(total - (taxable + tax + tip));
  return {
    subtotal,
    discount,
    taxable,
    tax,
    taxPercent: tax > 0 && taxable > 0 ? round2((tax / taxable) * 100) : 0,
    tip,
    roundOff: Math.abs(roundOff) >= 0.01 ? roundOff : 0,
    total,
  };
}

/** "GST @ 18%" (or "GST @ 0%") — just the tax name when the rate is unknown. */
export function taxLabel(taxName: string | null | undefined, taxPercent: number | null | undefined): string {
  const name = taxName?.trim() || "GST";
  return taxPercent == null ? name : `${name} @ ${Number(taxPercent.toFixed(2))}%`;
}
