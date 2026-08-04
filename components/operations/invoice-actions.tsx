"use client";

// ============================================================================
// MODULE : Invoices — delivery actions
//
// Preview, print, download, email, WhatsApp and reprint for one invoice. Sits on
// the billing detail page, which every manual flow ends at — a walk-in sale, a
// membership sale and an appointment bill all produce an Invoice and therefore
// all reach this bar.
//
// Every button drives an EXISTING endpoint: the PDF comes from
// /billing/:id/pdf (the same document in all three cases), delivery from
// /billing/:id/send, and the reprint record from /billing/:id/reprint.
// ============================================================================

import * as React from "react";
import {
  Printer,
  Download,
  Mail,
  MessageCircle,
  Eye,
  Loader2,
  Copy,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { API } from "@/lib/endpoints";

const btnGhost =
  "inline-flex items-center gap-1.5 rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-white/5";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-white/90";
const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:focus:border-white/30";

type Panel = "none" | "email" | "whatsapp" | "reprint";

export function InvoiceActions({
  invoiceId,
  invoiceNo,
  customerPhone,
  customerEmail,
  canReprint,
}: {
  invoiceId: string;
  invoiceNo: string;
  customerPhone: string | null;
  customerEmail: string | null;
  /** Reception may reprint; a worker viewing an invoice may not. */
  canReprint: boolean;
}) {
  const pdfUrl = `${API.reception.bill(invoiceId)}/pdf`;

  const [panel, setPanel] = React.useState<Panel>("none");
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<{ tone: "ok" | "warn" | "err"; text: string } | null>(null);

  const [email, setEmail] = React.useState(customerEmail ?? "");
  const [phone, setPhone] = React.useState(customerPhone ?? "");
  const [reason, setReason] = React.useState("");
  const [waLink, setWaLink] = React.useState<string | null>(null);

  /**
   * Printing opens the PDF itself rather than window.print() on the page: the
   * page is a screen layout, while the PDF is the A4 document the salon actually
   * hands over. The browser's viewer then drives whichever printer is attached —
   * A4 or an 80mm/58mm thermal roll — through its own paper-size setting.
   */
  function openPdf(inline: boolean) {
    window.open(`${pdfUrl}${inline ? "?inline=true" : ""}`, "_blank", "noopener,noreferrer");
  }

  async function send(channel: "EMAIL" | "WHATSAPP") {
    if (busy) return;
    setBusy(true);
    setNote(null);
    setWaLink(null);

    try {
      const res = await fetch(`${API.reception.bill(invoiceId)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          to: channel === "EMAIL" ? email.trim() : phone.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      setBusy(false);

      if (!res.ok || !json?.success) {
        const fieldErrors = json?.errors
          ? Object.values(json.errors as Record<string, string[]>).flat().join(" · ")
          : "";
        setNote({ tone: "err", text: fieldErrors || json?.message || "Could not send." });
        return;
      }

      if (channel === "WHATSAPP") {
        const url: string | undefined = json.data.handoffUrl ?? json.data.link;
        if (url) {
          setWaLink(url);
          // Opened straight away so the operator does not need a second click;
          // the link stays on screen in case the pop-up was blocked.
          window.open(url, "_blank", "noopener,noreferrer");
        }
        // The server's own words. With no WhatsApp Business API configured it
        // says so plainly rather than claiming the invoice was delivered —
        // "Sent" would be a claim nobody on this side can stand behind.
        setNote({
          tone: json.data.providerTransmits ? "ok" : "warn",
          text: json.message,
        });
      } else {
        setNote({ tone: "ok", text: json.message });
        setPanel("none");
      }
    } catch {
      setBusy(false);
      setNote({ tone: "err", text: "Network error — please try again." });
    }
  }

  async function recordReprint() {
    if (busy) return;
    if (reason.trim().length < 3) {
      setNote({ tone: "err", text: "Give a reason for the reprint." });
      return;
    }

    setBusy(true);
    setNote(null);

    try {
      const res = await fetch(`${API.reception.bill(invoiceId)}/reprint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = await res.json().catch(() => null);
      setBusy(false);

      if (!res.ok || !json?.success) {
        setNote({ tone: "err", text: json?.message ?? "Could not record the reprint." });
        return;
      }

      setReason("");
      setPanel("none");
      setNote({ tone: "ok", text: "Reprint recorded — opening the invoice." });
      openPdf(true);
    } catch {
      setBusy(false);
      setNote({ tone: "err", text: "Network error — please try again." });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => openPdf(true)} className={btnGhost}>
          <Eye className="size-3.5" aria-hidden="true" /> Preview
        </button>
        <button type="button" onClick={() => openPdf(true)} className={btnGhost}>
          <Printer className="size-3.5" aria-hidden="true" /> Print
        </button>
        <button type="button" onClick={() => openPdf(false)} className={btnGhost}>
          <Download className="size-3.5" aria-hidden="true" /> Download PDF
        </button>
        <button
          type="button"
          onClick={() => { setPanel(panel === "email" ? "none" : "email"); setNote(null); }}
          className={cn(btnGhost, panel === "email" && "border-gray-400 dark:border-white/40")}
        >
          <Mail className="size-3.5" aria-hidden="true" /> Email
        </button>
        <button
          type="button"
          onClick={() => { setPanel(panel === "whatsapp" ? "none" : "whatsapp"); setNote(null); }}
          className={cn(btnGhost, panel === "whatsapp" && "border-gray-400 dark:border-white/40")}
        >
          <MessageCircle className="size-3.5" aria-hidden="true" /> WhatsApp
        </button>
        {canReprint && (
          <button
            type="button"
            onClick={() => { setPanel(panel === "reprint" ? "none" : "reprint"); setNote(null); }}
            className={cn(btnGhost, panel === "reprint" && "border-gray-400 dark:border-white/40")}
          >
            <Copy className="size-3.5" aria-hidden="true" /> Reprint
          </button>
        )}
      </div>

      {note && (
        <p
          className={cn(
            "rounded border px-3 py-2 text-xs",
            note.tone === "ok"
              ? "border-green-100 bg-green-50 text-green-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
              : note.tone === "warn"
                // Amber, not green: the message was handed off, not delivered.
                ? "border-amber-100 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
                : "border-red-100 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
          )}
        >
          {note.text}
        </p>
      )}

      {waLink && (
        <p className="text-xs text-gray-500 dark:text-(--sa-text-2)">
          Did not open?{" "}
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="underline">
            Open WhatsApp manually
          </a>
        </p>
      )}

      {panel !== "none" && (
        <div className="rounded border border-gray-200 p-3 dark:border-(--sa-border)">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700 dark:text-(--sa-text)">
              {panel === "email"
                ? `Email invoice ${invoiceNo}`
                : panel === "whatsapp"
                  ? `Send invoice ${invoiceNo} on WhatsApp`
                  : `Reprint invoice ${invoiceNo}`}
            </span>
            <button
              type="button"
              onClick={() => setPanel("none")}
              aria-label="Close"
              className="rounded p-1 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/10"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          {panel === "email" && (
            <div className="flex flex-wrap items-end gap-2">
              <span className="min-w-56 flex-1">
                <label className="mb-1 block text-xs text-gray-600 dark:text-(--sa-text-2)" htmlFor="inv-email">
                  Email address
                </label>
                <input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className={inputCls} placeholder="customer@example.com" />
              </span>
              <button type="button" onClick={() => void send("EMAIL")} disabled={busy} className={btnPrimary}>
                {busy && <Loader2 className="size-3.5 animate-spin" />} Send with PDF
              </button>
            </div>
          )}

          {panel === "whatsapp" && (
            <div className="flex flex-wrap items-end gap-2">
              <span className="min-w-56 flex-1">
                <label className="mb-1 block text-xs text-gray-600 dark:text-(--sa-text-2)" htmlFor="inv-phone">
                  Mobile number
                </label>
                <input id="inv-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  className={inputCls} placeholder="9876543210" />
                {!customerPhone && (
                  <span className="mt-1 block text-[11px] text-amber-600 dark:text-amber-400">
                    This customer has no saved number — enter one to continue.
                  </span>
                )}
              </span>
              <button type="button" onClick={() => void send("WHATSAPP")} disabled={busy} className={btnPrimary}>
                {busy && <Loader2 className="size-3.5 animate-spin" />} Open WhatsApp
              </button>
            </div>
          )}

          {panel === "reprint" && (
            <div className="flex flex-wrap items-end gap-2">
              <span className="min-w-56 flex-1">
                <label className="mb-1 block text-xs text-gray-600 dark:text-(--sa-text-2)" htmlFor="inv-reason">
                  Reason for reprint
                </label>
                <input id="inv-reason" value={reason} onChange={(e) => setReason(e.target.value)}
                  className={inputCls} maxLength={300} placeholder="e.g. Customer lost the original" />
              </span>
              <button type="button" onClick={() => void recordReprint()} disabled={busy} className={btnPrimary}>
                {busy && <Loader2 className="size-3.5 animate-spin" />} Record & print
              </button>
            </div>
          )}

          <p className="mt-2 text-[11px] text-gray-400 dark:text-(--sa-muted)">
            {panel === "whatsapp"
              ? "With no WhatsApp Business API configured this opens WhatsApp with the message ready — you must press send there. It is logged as Opened, not Sent."
              : panel === "email"
                ? "The same PDF the Download button produces is attached. Delivery is logged."
                : "The document is unchanged — the reprint is recorded against your name."}
          </p>
        </div>
      )}
    </div>
  );
}
