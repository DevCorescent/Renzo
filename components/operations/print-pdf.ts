// ============================================================================
// MODULE : Invoices — print the invoice PDF (browser side)
//
// Print sends the SAME A4 invoice that Preview shows (/billing/:id/pdf?format=A4).
//
// On a desktop browser the PDF is loaded into a hidden same-origin frame and the
// print dialog opens straight away — no extra tab. Phones and tablets cannot
// print a framed PDF, so there the PDF opens in a new tab, where the viewer's own
// Print / Share is one tap away. Any failure falls back to the new tab too.
// ============================================================================

import { API } from "@/lib/endpoints";

/** The A4 invoice PDF, shown in the browser (not downloaded). */
export function invoicePdfUrl(invoiceId: string): string {
  return `${API.reception.bill(invoiceId)}/pdf?format=A4&inline=true`;
}

function openInTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Touch devices (phones, tablets) cannot print a PDF inside a frame. */
function isTouchDevice(): boolean {
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

export function printInvoicePdf(invoiceId: string): void {
  const url = invoicePdfUrl(invoiceId);
  if (isTouchDevice()) return openInTab(url);

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      openInTab(url);
    }
    // Removed well after the dialog closes; removing it early cancels the print.
    setTimeout(() => frame.remove(), 60_000);
  };
  document.body.appendChild(frame);
}
