import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { err } from "@/lib/response";
import {
  invoiceFilename,
  loadInvoiceForDelivery,
  renderInvoicePdf,
  toPrintFormat,
} from "@/lib/invoice-delivery";

// GET /api/v1/reception/billing/[id]/pdf
// Returns the invoice as a downloadable PDF.
//
// The query and the InvoicePdfData mapping moved to lib/invoice-delivery.ts when
// invoices also needed emailing: the download and the email attachment are now
// built by the SAME function, so the two can never drift into different documents.
// `?inline=true` renders it in the browser's viewer instead of downloading —
// that is the Preview and Print path, which needs no second endpoint.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(
    req,
    "RECEPTIONIST",
    "BRANCH_ADMIN",
    "SUPER_ADMIN",
    "OWNER",
    "ACCOUNTANT"
  );
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const { id } = await params;

    const invoice = await loadInvoiceForDelivery(id);
    if (!invoice) return err("Invoice not found", 404);

    // Same rule as /send and /reprint: another branch's invoice answers 404, so a
    // branch-scoped account can neither print it nor learn that it exists.
    if (!scope.isGlobal && invoice.branchId !== scope.branchId) {
      return err("Invoice not found", 404);
    }

    const url = new URL(req.url);
    // ?format=THERMAL_80 prints a till receipt from a branch set to A4, without
    // changing the branch's default. Anything unrecognised falls back to it.
    const requested = url.searchParams.get("format");
    const buffer = await renderInvoicePdf(
      invoice,
      requested ? toPrintFormat(requested) : undefined
    );
    const inline = url.searchParams.get("inline") === "true";

    // Exactly the PDF's bytes. `buffer.buffer` is the whole memory block the
    // Buffer sits in: where Node shares one block between small buffers, that
    // sent other data alongside (or instead of) the PDF and the browser could
    // not open it. `new Uint8Array(buffer)` copies just these bytes.
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${invoiceFilename(
          invoice.invoiceNo
        )}"`,
        "Content-Length": String(buffer.length),
        // A customer's invoice: never cached by a CDN or shared proxy, and never
        // re-sniffed as anything but a PDF.
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("[PDF] Failed to generate invoice PDF:", e);
    return err("Failed to generate PDF", 500);
  }
}
