// ============================================================================
// MODULE : Invoices — shared loading, PDF building and delivery text
//
// Extracted from app/api/v1/reception/billing/[id]/pdf/route.ts when invoices
// needed to be EMAILED and shared on WhatsApp as well as downloaded. The query
// and the InvoicePdfData mapping now live here, so the download, the email
// attachment and the preview are byte-identical documents built by one function
// — which is the whole point of requirement 27: a manual invoice and an
// automated one must be the same invoice.
//
// Reuses lib/invoice-pdf.tsx (the existing renderer) unchanged.
// ============================================================================

import prisma from "@/lib/db";
import { invoiceBreakdown } from "@/lib/invoice-breakdown";
import {
  generateInvoicePdf,
  type InvoicePdfData,
  type PrintFormat,
} from "@/lib/invoice-pdf";

const PRINT_FORMATS: PrintFormat[] = ["A4", "THERMAL_80", "THERMAL_58"];

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash", UPI: "UPI", CARD: "Card",
  WALLET: "Wallet", GIFT_CARD: "Gift Card", BANK_TRANSFER: "Bank Transfer",
};
const fmtMethod = (m: string): string =>
  METHOD_LABELS[m] ?? m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Fall back to A4 for any unrecognised branch setting. */
function toPrintFormat(value: string | null | undefined): PrintFormat {
  return PRINT_FORMATS.includes(value as PrintFormat) ? (value as PrintFormat) : "A4";
}

/** Everything the delivery surfaces need about one invoice. */
export type LoadedInvoice = {
  id: string;
  invoiceNo: string;
  branchId: string;
  customerId: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
  customerName: string;
  /** For a greeting ("Hello Nazim"); "Customer" when no name is stored. */
  customerFirstName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  branchName: string;
  /** The paper this branch's till prints on. */
  printFormat: PrintFormat;
  pdf: InvoicePdfData;
};

/**
 * Load an invoice and build its PDF payload in one place.
 *
 * Returns null when it does not exist. Branch scoping is the CALLER's job —
 * every route that uses this already holds a BranchScope, and doing it here
 * would hide the check from the route that must be seen to perform it.
 */
export async function loadInvoiceForDelivery(id: string): Promise<LoadedInvoice | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      items: { select: { type: true, refId: true, name: true, quantity: true, unitPrice: true, total: true } },
      payments: { select: { method: true, amount: true }, orderBy: { paidAt: "asc" } },
    },
  });
  if (!invoice) return null;

  const [customer, branch, appointment] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: invoice.customerId },
      select: { firstName: true, lastName: true, phone: true, email: true },
    }),
    prisma.branch.findUnique({
      where: { id: invoice.branchId },
      select: {
        name: true,
        setting: {
          select: {
            printFormat: true,
            taxName: true,
            taxNumber: true,
            invoiceBusinessName: true,
            invoiceTagline: true,
            invoiceAddress: true,
            invoicePhone: true,
            invoiceEmail: true,
            invoiceWebsite: true,
            invoiceFooterNote: true,
          },
        },
      },
    }),
    // Who did the work — the "Staff" box and each service line. Read live, so a
    // stylist corrected after billing shows on the next print. Only appointment
    // bills have one.
    invoice.appointmentId
      ? prisma.appointment.findUnique({
          where: { id: invoice.appointmentId },
          select: {
            worker: { select: { firstName: true } },
            services: {
              select: { serviceId: true, price: true, worker: { select: { firstName: true } } },
            },
          },
        })
      : Promise.resolve(null),
  ]);

  /** Distinct, capitalised first names — "Farhan, Riyaz", or just "Farhan". */
  const names = (list: (string | null | undefined)[]) =>
    [...new Set(list.map((n) => n?.trim()).filter((n): n is string => Boolean(n)).map(titleCase))].join(", ");

  const staffNames = names([
    ...(appointment?.services ?? []).map((s) => s.worker?.firstName),
    appointment?.worker?.firstName,
  ]);

  /**
   * Who performed one invoice line: the appointment's rows for that service at
   * that price (a line groups one row per person), falling back to the service
   * alone. Lines added at the desk, products and blank bills have no rows.
   */
  const lineStaff = (item: { type: string; refId: string | null; unitPrice: number }) => {
    if (item.type !== "SERVICE" || !item.refId || !appointment) return undefined;
    const rows = appointment.services.filter((s) => s.serviceId === item.refId);
    const samePrice = rows.filter((s) => Number(s.price) === Number(item.unitPrice));
    return names((samePrice.length ? samePrice : rows).map((s) => s.worker?.firstName)) || undefined;
  };

  // GST rate actually charged, and any tip — for the printed breakdown.
  const money = invoiceBreakdown({
    subtotal: Number(invoice.subtotal),
    discountAmount: Number(invoice.discountAmount),
    taxAmount: Number(invoice.taxAmount),
    totalAmount: Number(invoice.totalAmount),
    items: invoice.items.map((i) => ({ type: i.type, total: Number(i.total) })),
  });

  const customerName =
    `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() || "Customer";
  const branchName = branch?.name ?? "";

  const date = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(invoice.createdAt);

  // "28 Sep 2026 • 11:40 AM" — the A4 invoice's Date & Time box. Month spelled
  // out by hand: en-IN abbreviates September as "Sept".
  const part = (type: string) =>
    new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata", day: "2-digit", month: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    }).formatToParts(invoice.createdAt).find((p) => p.type === type)?.value ?? "";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateTime =
    `${part("day")} ${MONTHS[Number(part("month")) - 1]} ${part("year")} • ` +
    `${part("hour")}:${part("minute")} ${part("dayPeriod").toUpperCase()}`;

  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    branchId: invoice.branchId,
    customerId: invoice.customerId,
    totalAmount: Number(invoice.totalAmount),
    paidAmount: Number(invoice.paidAmount),
    balanceDue: Number(invoice.balanceDue),
    status: invoice.status,
    customerName,
    customerFirstName: customer?.firstName?.trim() || "Customer",
    customerPhone: customer?.phone ?? null,
    customerEmail: customer?.email ?? null,
    branchName,
    printFormat: toPrintFormat(branch?.setting?.printFormat),
    pdf: {
      invoiceNo: invoice.invoiceNo,
      date,
      dateTime,
      branch: branchName,
      staff: staffNames || undefined,
      customerName,
      customerPhone: customer?.phone ?? undefined,
      items: invoice.items.map((item) => ({
        label: `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`,
        amount: Number(item.total),
        name: item.name,
        quantity: item.quantity,
        rate: Number(item.unitPrice),
        staff: lineStaff(item),
      })),
      subtotal: Number(invoice.subtotal),
      discount: Number(invoice.discountAmount),
      tax: Number(invoice.taxAmount),
      taxPercent: money.taxPercent,
      tip: money.tip || undefined,
      total: Number(invoice.totalAmount),
      paid: Number(invoice.paidAmount),
      balance: Number(invoice.balanceDue),
      payments: invoice.payments.map(p => ({ method: fmtMethod(p.method), amount: Number(p.amount) })),
      businessName: branch?.setting?.invoiceBusinessName ?? undefined,
      tagline: branch?.setting?.invoiceTagline ?? undefined,
      address: branch?.setting?.invoiceAddress ?? undefined,
      phone: branch?.setting?.invoicePhone ?? undefined,
      email: branch?.setting?.invoiceEmail ?? undefined,
      website: branch?.setting?.invoiceWebsite ?? undefined,
      footerNote: branch?.setting?.invoiceFooterNote ?? undefined,
      taxName: branch?.setting?.taxName ?? undefined,
      taxNumber: branch?.setting?.taxNumber ?? undefined,
    },
  };
}

/**
 * Render the invoice PDF. One renderer, one data set, every channel.
 *
 * `override` lets the operator print a till receipt from a branch set to A4 (or
 * the reverse) without changing the branch's default.
 */
export async function renderInvoicePdf(
  invoice: LoadedInvoice,
  override?: PrintFormat
): Promise<Buffer> {
  return generateInvoicePdf(invoice.pdf, override ?? invoice.printFormat);
}

export { PRINT_FORMATS, toPrintFormat };
export type { PrintFormat };

export function invoiceFilename(invoiceNo: string): string {
  return `Invoice-${invoiceNo}.pdf`;
}

// ============================================================================
// MESSAGE TEMPLATES
// ============================================================================

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** ₹2,999 — paise shown only when there are any, so ₹2,999.50 is not rounded away. */
const amountPaid = (n: number) =>
  `₹${n.toLocaleString("en-IN", Number.isInteger(n) ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** "raghu" → "Raghu", "mary ann" → "Mary Ann" — for the greeting only; the stored name is untouched. */
const titleCase = (name: string) =>
  name.replace(/(^|\s)(\S)/g, (_, sp: string, c: string) => sp + c.toUpperCase());

/**
 * The WhatsApp body, carried in the `wa.me` deep link.
 *
 * Plain text on purpose: formatting markup would arrive as literal asterisks on
 * some clients. A wa.me link cannot carry the PDF, so the invoice screens
 * download it alongside (components/operations/whatsapp-invoice.ts) for the
 * operator to attach.
 */
export function invoiceMessage(invoice: LoadedInvoice): string {
  return [
    `Hello ${titleCase(invoice.customerFirstName)},`,
    ``,
    `Thank you for visiting Renzo.`,
    `Your invoice ${invoice.invoiceNo} has been generated.`,
    ``,
    `Amount Paid: ${amountPaid(invoice.paidAmount)}`,
    // A part-paid customer must still be told what they owe.
    ...(invoice.balanceDue > 0 ? [`Balance Due: ${amountPaid(invoice.balanceDue)}`] : []),
    ``,
    `We look forward to serving you again.`,
    // The branch's invoice brand, upper-cased exactly as the PDF header prints it.
    `— ${invoice.pdf.businessName ? invoice.pdf.businessName.toUpperCase() : "Renzo Hair & Beauty Studio"}`,
  ].join("\n");
}

/** The email body. Kept close to the project's other transactional mail. */
export function invoiceEmailHtml(invoice: LoadedInvoice): string {
  const rows = invoice.pdf.items
    .map(
      (item) =>
        `<tr><td style="padding:6px 0;color:#2b2b2b">${escapeHtml(item.label)}</td>` +
        `<td style="padding:6px 0;text-align:right;color:#2b2b2b">${inr(item.amount)}</td></tr>`
    )
    .join("");

  return `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#2b2b2b">
  <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#d4687a;margin:0 0 4px">Renzo</p>
  <h1 style="font-size:18px;margin:0 0 4px">Invoice ${escapeHtml(invoice.invoiceNo)}</h1>
  <p style="margin:0 0 16px;color:#888;font-size:13px">${escapeHtml(invoice.pdf.date)}${
    invoice.branchName ? ` · ${escapeHtml(invoice.branchName)}` : ""
  }</p>

  <p style="font-size:14px">Hello ${escapeHtml(invoice.customerName)},</p>
  <p style="font-size:14px">Thank you for visiting Renzo. Your invoice is attached as a PDF.</p>

  <table style="width:100%;border-collapse:collapse;font-size:13px;margin:16px 0">
    ${rows}
    <tr><td colspan="2" style="border-top:1px solid #e7e7e7;padding-top:8px"></td></tr>
    <tr><td style="padding:2px 0;color:#888">Subtotal</td><td style="padding:2px 0;text-align:right">${inr(
      invoice.pdf.subtotal
    )}</td></tr>
    ${
      invoice.pdf.discount > 0
        ? `<tr><td style="padding:2px 0;color:#888">Discount</td><td style="padding:2px 0;text-align:right">− ${inr(
            invoice.pdf.discount
          )}</td></tr>`
        : ""
    }
    ${
      invoice.pdf.tax > 0
        ? `<tr><td style="padding:2px 0;color:#888">Tax</td><td style="padding:2px 0;text-align:right">${inr(
            invoice.pdf.tax
          )}</td></tr>`
        : ""
    }
    <tr><td style="padding:6px 0;font-weight:700">Total</td><td style="padding:6px 0;text-align:right;font-weight:700">${inr(
      invoice.pdf.total
    )}</td></tr>
    ${
      invoice.balanceDue > 0
        ? `<tr><td style="padding:2px 0;color:#c0392b">Balance due</td><td style="padding:2px 0;text-align:right;color:#c0392b">${inr(
            invoice.balanceDue
          )}</td></tr>`
        : ""
    }
  </table>

  <p style="font-size:13px;color:#888">We look forward to serving you again.</p>
  <p style="font-size:13px;color:#888;margin:0">— Renzo Hair &amp; Beauty Studio</p>
</div>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * A `wa.me` deep link carrying the prefilled message.
 *
 * WHY A LINK AND NOT A SERVER-SIDE SEND: this project has no WhatsApp Business
 * API credentials — the only WhatsApp integration that exists anywhere in the
 * codebase is the same deep-link pattern used by gift-card sharing. Rather than
 * invent a provider and fake a delivery status the salon cannot rely on, the
 * button opens WhatsApp with the message ready, and the delivery attempt is
 * recorded as SENT once the operator confirms. Wiring a real provider later
 * means changing this ONE function.
 */
export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  // wa.me needs a country code; Indian numbers are stored bare, so 91 is added
  // when the number is a plain 10-digit one.
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}
