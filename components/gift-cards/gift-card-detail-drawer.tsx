"use client";

// OWNER: Gauransh
// MODULE: Marketing — Gift Card detail drawer
// PURPOSE: Show a gift card's Information + Balance + Purchaser + Owner + Redemption
//          history + Purchase history. Basic fields come from the row; owner details
//          and redemptions are fetched from GET /admin/gift-cards/[id] on open.

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/shared/ui";
import { API } from "@/lib/endpoints";
import { CopyCodeButton } from "./copy-code-button";
import {
  STATUS_TONE, money, formatDate,
  type ApiEnvelope, type GiftCardDetail, type GiftCardRedemptionRow, type GiftCardRow, type GiftCardTransferRow,
} from "./types";

export function GiftCardDetailDrawer({ card, onClose }: { card: GiftCardRow | null; onClose: () => void }) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const open = card !== null;
  const cardId = card?.id ?? null;

  const [redemptions, setRedemptions] = React.useState<GiftCardRedemptionRow[]>([]);
  const [transfers, setTransfers] = React.useState<GiftCardTransferRow[]>([]);
  const [ownerPhone, setOwnerPhone] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  React.useEffect(() => {
    if (!open || !cardId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setRedemptions([]);
      setTransfers([]);
      setOwnerPhone(null);
      try {
        const res = await fetch(API.admin.giftCard(cardId));
        const json = (await res.json()) as ApiEnvelope<GiftCardDetail>;
        if (!cancelled && res.ok && json.success && json.data) {
          setRedemptions(json.data.redemptions ?? []);
          setTransfers(json.data.transfers ?? []);
          setOwnerPhone(json.data.owner?.phone ?? null);
        }
      } catch {
        /* history stays empty on a transient failure */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, cardId]);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
      aria-labelledby="gc-detail-title"
      className="ml-auto h-dvh w-[calc(100vw-2rem)] max-w-lg rounded-none border-l border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      {card && (
        <div className="flex h-dvh flex-col">
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
            <div className="min-w-0">
              <h2 id="gc-detail-title" className="flex items-center gap-1.5 font-mono text-sm font-semibold text-gray-900">
                {card.code} <CopyCodeButton code={card.code} /> <Badge tone={STATUS_TONE[card.status]}>{card.status}</Badge>
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">{card.type} · issued {formatDate(card.purchasedAt)}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"><X className="size-4" /></button>
          </div>

          <div className="flex-1 overflow-auto">
            <Section title="Gift card information">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                <Detail label="Value" value={money(card.value)} />
                <Detail label="Balance" value={money(card.balance)} />
                <Detail label="Expires" value={formatDate(card.expiresAt)} />
                <Detail label="Recipient" value={card.recipientName || "—"} />
                <Detail label="Recipient phone" value={card.recipientPhone || "—"} />
              </dl>
              {card.giftMessage && <p className="mt-3 text-xs text-gray-600">“{card.giftMessage}”</p>}
            </Section>

            <Section title="Purchaser & owner">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <Detail label="Purchased by" value={card.purchasedByName || "—"} />
                <Detail label="Current owner" value={card.ownerName || card.purchasedByName || "—"} />
                {ownerPhone && <Detail label="Owner phone" value={ownerPhone} />}
              </dl>
            </Section>

            <Section title="Purchase history">
              <p className="text-xs text-gray-600">{card.purchasedByName || "A customer"} purchased this card for {money(card.value)} on {formatDate(card.purchasedAt)}.</p>
            </Section>

            <Section title="Transfer history">
              {loading ? (
                <p className="py-2 text-center text-xs text-gray-400">Loading…</p>
              ) : transfers.length === 0 ? (
                <p className="text-xs text-gray-400">No transfers — still owned by the original purchaser.</p>
              ) : (
                <ul className="space-y-1.5">
                  {transfers.map((t) => (
                    <li key={t.id} className="flex items-center justify-between rounded border border-gray-100 px-3 py-2 text-xs">
                      <span className="text-gray-700">{t.from} → {t.to}</span>
                      <span className="text-gray-400">{formatDate(t.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <div className="px-5 py-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Redemption history</h3>
              {loading ? (
                <p className="py-6 text-center text-xs text-gray-400">Loading…</p>
              ) : redemptions.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-400">No redemptions yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {redemptions.map((r) => (
                    <li key={r.id} className="flex items-center justify-between rounded border border-gray-100 px-3 py-2 text-xs">
                      <span className="text-gray-700">−{money(r.amount)}</span>
                      <span className="text-gray-400">Invoice {r.invoiceId.slice(0, 8)} · {formatDate(r.redeemedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="border-b border-gray-100 px-5 py-4"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h3>{children}</div>;
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-gray-400">{label}</dt><dd className="mt-0.5 font-medium text-gray-800">{value}</dd></div>;
}
