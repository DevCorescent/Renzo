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
import {
  generateInvoicePdf,
  type InvoicePdfData,
  type PrintFormat,
} from "@/lib/invoice-pdf";

const PRINT_FORMATS: PrintFormat[] = ["A4", "THERMAL_80", "THERMAL_58"];

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
      items: { select: { name: true, quantity: true, total: true } },
      payments: { select: { method: true }, orderBy: { paidAt: "desc" }, take: 1 },
    },
  });
  if (!invoice) return null;

  const [customer, branch] = await Promise.all([
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
  ]);

  const customerName =
    `${customer?.firstName ?? ""} ${customer?.lastName ?? ""}`.trim() || "Customer";
  const branchName = branch?.name ?? "";

  const date = new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(invoice.createdAt);

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
    customerPhone: customer?.phone ?? null,
    customerEmail: customer?.email ?? null,
    branchName,
    printFormat: toPrintFormat(branch?.setting?.printFormat),
    pdf: {
      invoiceNo: invoice.invoiceNo,
      date,
      branch: branchName,
      customerName,
      customerPhone: customer?.phone ?? undefined,
      items: invoice.items.map((item) => ({
        label: `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`,
        amount: Number(item.total),
      })),
      subtotal: Number(invoice.subtotal),
      discount: Number(invoice.discountAmount),
      tax: Number(invoice.taxAmount),
      total: Number(invoice.totalAmount),
      paid: Number(invoice.paidAmount),
      balance: Number(invoice.balanceDue),
      method: invoice.payments[0]?.method ?? "",
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

/**
 * The WhatsApp / SMS body.
 *
 * Plain text on purpose: it is carried in a `wa.me` deep link, and formatting
 * markup would arrive as literal asterisks on some clients.
 */
export function invoiceMessage(invoice: LoadedInvoice, pdfUrl?: string): string {
  const lines = [
    `Hello ${invoice.customerName},`,
    ``,
    `Thank you for visiting Renzo.`,
    `Your invoice ${invoice.invoiceNo} has been generated.`,
    ``,
    `Amount ${invoice.balanceDue > 0 ? "Payable" : "Paid"}: ${inr(
      invoice.balanceDue > 0 ? invoice.totalAmount : invoice.paidAmount
    )}`,
  ];

  if (invoice.balanceDue > 0) {
    lines.push(`Balance Due: ${inr(invoice.balanceDue)}`);
  }
  if (pdfUrl) {
    lines.push(``, `Invoice: ${pdfUrl}`);
  }

  lines.push(
    ``,
    `We look forward to serving you again.`,
    `— Renzo Hair & Beauty Studio${invoice.branchName ? `, ${invoice.branchName}` : ""}`
  );

  return lines.join("\n");
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
