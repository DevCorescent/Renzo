import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
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
  const { error } = await requireAuth(
    req,
    "RECEPTIONIST",
    "BRANCH_ADMIN",
    "SUPER_ADMIN",
    "OWNER",
    "ACCOUNTANT"
  );
  if (error) return error;

  try {
    const { id } = await params;

    const invoice = await loadInvoiceForDelivery(id);
    if (!invoice) return err("Invoice not found", 404);

    const url = new URL(req.url);
    // ?format=THERMAL_80 prints a till receipt from a branch set to A4, without
    // changing the branch's default. Anything unrecognised falls back to it.
    const requested = url.searchParams.get("format");
    const buffer = await renderInvoicePdf(
      invoice,
      requested ? toPrintFormat(requested) : undefined
    );
    const inline = url.searchParams.get("inline") === "true";

    return new NextResponse(buffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${invoiceFilename(
          invoice.invoiceNo
        )}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    console.error("[PDF] Failed to generate invoice PDF:", e);
    return err("Failed to generate PDF", 500);
  }
}
