"use client";

// OWNER: Gauransh
// MODULE: Customer Gift Cards — share action
// PURPOSE: Let a gift-card owner share/transfer their card, using the existing
//          GiftCard.code as the single token.
//   • Copy code / WhatsApp / SMS / Email → purely client-side: they share the CODE
//     externally (no backend, no ownership change).
//   • Transfer to a registered customer (by phone) → POST /customer/gift-cards/share,
//     which updates ONLY ownedBy (purchaser is immutable). On success it refreshes
//     the list; a 404 means the phone isn't registered, so fall back to an external
//     share.
//   • Error handling: backend messages shown inline; nothing crashes.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Share2, Copy, Check, X, MessageCircle, Mail, Phone, Send } from "lucide-react";
import { API } from "@/lib/endpoints";

const shareText = (code: string) => `I've sent you a Renzo gift card! Redeem it with code ${code}.`;

export function GiftCardShare({ code }: { code: string }) {
  const router = useRouter();
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [open, setOpen] = React.useState(false);
  const [phone, setPhone] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const [msg, setMsg] = React.useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  const text = encodeURIComponent(shareText(code));

  async function copy() {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setMsg({ kind: "err", text: "Could not copy — copy the code manually." }); }
  }

  // Transfer ownership to a registered customer by phone (reuses the share endpoint).
  async function transfer() {
    if (sending || !phone.trim()) return;
    setSending(true);
    setMsg(null);
    try {
      const res = await fetch(API.customer.giftCardShare, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, recipientPhone: phone.trim() }),
      });
      const json = (await res.json()) as { success: boolean; message: string };
      if (!res.ok || !json.success) {
        setMsg({ kind: "err", text: res.status === 404 ? "That number isn't a registered customer — share the code via WhatsApp/SMS instead." : (json.message || "Could not share the gift card") });
        return;
      }
      setMsg({ kind: "ok", text: "Gift card transferred." });
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Could not reach the server. Please try again." });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setMsg(null); }} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-stone-800 px-2.5 py-1.5 text-xs font-medium text-stone-200 transition hover:bg-stone-700">
        <Share2 className="size-3.5" aria-hidden="true" /> Share
      </button>

      <dialog
        ref={dialogRef}
        onCancel={(e) => { e.preventDefault(); setOpen(false); }}
        onClick={(e) => { if (e.target === dialogRef.current) setOpen(false); }}
        aria-labelledby="gc-share-title"
        className="w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-white/10 bg-stone-900 p-0 text-stone-200 shadow-xl backdrop:bg-black/60"
      >
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <h2 id="gc-share-title" className="text-sm font-semibold text-stone-100">Share gift card</h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-stone-400 transition hover:bg-white/5 hover:text-stone-200"><X className="size-4" /></button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <p className="font-mono text-sm font-semibold tracking-widest text-stone-100">{code}</p>

          {/* External shares — send the code, no ownership change. */}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={copy} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-stone-800 px-3 py-2 text-xs font-medium text-stone-200 transition hover:bg-stone-700">
              {copied ? <><Check className="size-3.5 text-emerald-400" /> Copied</> : <><Copy className="size-3.5" /> Copy code</>}
            </button>
            <a href={`https://wa.me/?text=${text}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-stone-800 px-3 py-2 text-xs font-medium text-stone-200 transition hover:bg-stone-700"><MessageCircle className="size-3.5" /> WhatsApp</a>
            <a href={`sms:?body=${text}`} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-stone-800 px-3 py-2 text-xs font-medium text-stone-200 transition hover:bg-stone-700"><Phone className="size-3.5" /> SMS</a>
            <a href={`mailto:?subject=${encodeURIComponent("A Renzo gift card for you")}&body=${text}`} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-stone-800 px-3 py-2 text-xs font-medium text-stone-200 transition hover:bg-stone-700"><Mail className="size-3.5" /> Email</a>
          </div>

          {/* Transfer ownership to a registered customer by phone. */}
          <div className="border-t border-white/8 pt-3">
            <label className="block text-xs font-medium text-stone-300">Transfer to a registered customer</label>
            <div className="mt-1.5 flex gap-2">
              <input value={phone} onChange={(e) => { setPhone(e.target.value); setMsg(null); }} inputMode="tel" placeholder="Recipient phone number" className="h-9 w-full rounded-lg border border-white/10 bg-stone-800 px-2.5 text-sm text-stone-100 outline-none transition placeholder:text-stone-500 focus:border-white/25" />
              <button type="button" onClick={transfer} disabled={sending || !phone.trim()} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-gold px-3 text-xs font-semibold text-stone-950 transition hover:opacity-90 disabled:opacity-50">
                <Send className="size-3.5" aria-hidden="true" /> {sending ? "…" : "Transfer"}
              </button>
            </div>
            {msg && <p role="alert" className={`mt-2 text-[11px] ${msg.kind === "ok" ? "text-emerald-400" : "text-red-400"}`}>{msg.text}</p>}
            <p className="mt-1.5 text-[11px] text-stone-500">Transferring changes the owner; you remain the original purchaser.</p>
          </div>
        </div>
      </dialog>
    </>
  );
}
