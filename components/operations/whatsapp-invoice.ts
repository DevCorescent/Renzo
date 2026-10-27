// ============================================================================
// MODULE : Invoices — WhatsApp hand-off with the PDF (browser side)
//
// A wa.me link can carry text but not a file, and a web page cannot put a file
// into a WhatsApp Web tab. So "Send on WhatsApp" hands the operator BOTH halves:
// the invoice PDF is downloaded as INV-<no>.pdf, and the customer's chat opens
// with the message filled in. The operator attaches the PDF and presses send.
//
// The PDF is the existing /billing/:id/pdf document, fetched with the operator's
// own session — no public URL, no second renderer. A4 is requested because a
// 58 mm till receipt is unreadable on a phone.
//
// Shared by invoice-actions.tsx and walk-in-console.tsx.
// ============================================================================

import { API } from "@/lib/endpoints";

/** "INV-6S3P7JCGM.pdf" — the invoice number already carries the INV- prefix. */
export function whatsAppPdfFilename(invoiceNo: string): string {
  return `${invoiceNo}.pdf`;
}

/**
 * Fetch the A4 invoice PDF with the operator's session cookie. Throws an Error
 * whose message is fit to show the operator; `afterFailure` is appended to it
 * (e.g. "WhatsApp was not opened.").
 *
 * Always a fresh render from the database (`no-store`), so a bill edited a
 * moment ago downloads with its new figures.
 */
async function requestInvoicePdf(invoiceId: string, afterFailure = ""): Promise<Blob> {
  const tail = afterFailure ? ` ${afterFailure}` : "";
  let res: Response;
  try {
    res = await fetch(`${API.reception.bill(invoiceId)}/pdf?format=A4`, {
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch {
    throw new Error(`Network error — could not download the invoice PDF.${tail}`);
  }

  if (res.status === 401) {
    throw new Error(`Your session has expired — log in again and retry.${tail}`);
  }
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    // A platform timeout / gateway error has no JSON body — say what happened.
    const reason =
      json?.message ??
      (res.status === 504 || res.status === 502
        ? "The server took too long to build the invoice PDF — please try again"
        : `Could not generate the invoice PDF (error ${res.status})`);
    throw new Error(`${reason}.${tail}`);
  }

  const blob = await res.blob();
  if (blob.size === 0 || !(res.headers.get("content-type") ?? "").includes("application/pdf")) {
    throw new Error(`The server did not return a valid invoice PDF.${tail}`);
  }
  return blob;
}

/**
 * The PDF for the WhatsApp hand-off — fetched BEFORE WhatsApp opens, so a
 * failed PDF never leaves a message-only send looking like a complete one.
 */
export function fetchInvoicePdf(invoiceId: string): Promise<Blob> {
  return requestInvoicePdf(invoiceId, "WhatsApp was not opened.");
}

/**
 * Download PDF. Fetched first and saved from a Blob — not a navigation to the
 * endpoint — so a failure (expired session, server error, timeout) is reported
 * to the operator instead of opening a tab of raw JSON or saving a broken file.
 */
export async function downloadInvoicePdf(invoiceId: string, invoiceNo: string): Promise<void> {
  saveInvoicePdf(await requestInvoicePdf(invoiceId), invoiceNo);
}

/**
 * The object URL of the last PDF handed to the browser. Kept alive until the
 * next download replaces it or the page is left: a browser gives no signal when
 * an <a download> has finished writing the file, and phones write it in the
 * background — revoking it after a fixed second left them with an empty,
 * unopenable file. At most one small PDF is held.
 */
let lastPdfUrl: string | null = null;

function releaseLastPdf() {
  if (lastPdfUrl) URL.revokeObjectURL(lastPdfUrl);
  lastPdfUrl = null;
}

if (typeof window !== "undefined") window.addEventListener("pagehide", releaseLastPdf);

/** Save the PDF to the operator's downloads as INV-<no>.pdf. */
export function saveInvoicePdf(pdf: Blob, invoiceNo: string): void {
  releaseLastPdf(); // the previous download has long since finished
  const url = URL.createObjectURL(pdf);
  lastPdfUrl = url;
  const a = document.createElement("a");
  a.href = url;
  a.download = whatsAppPdfFilename(invoiceNo);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Open the chat. False when the browser blocked the new tab.
 *
 * Not opened with "noopener": that makes window.open return null ALWAYS, so a
 * blocked pop-up could not be told apart from an opened one. Severing `opener`
 * on the returned window gives the same protection.
 */
export function openWhatsAppChat(link: string): boolean {
  const tab = window.open(link, "_blank");
  if (!tab) return false;
  tab.opener = null;
  return true;
}
