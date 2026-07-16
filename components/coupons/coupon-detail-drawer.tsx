"use client";

// OWNER: Gauransh
// MODULE: Marketing — Coupon detail drawer
// PURPOSE: Show a coupon's Information + Validity + Usage analytics + customer usage
//          history. Basic fields come from the already-loaded row; the usage history
//          is fetched from GET /admin/coupons/[id] (usages + customer) on open.
//   • Backend interaction: one GET per opened coupon.
//   • Error handling: a failed fetch leaves the history empty; the rest still shows.

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/shared/ui";
import { API } from "@/lib/endpoints";
import {
  STATUS_META, couponStatus, couponValue, money, formatDate, validityText, applicableLabel,
  type ApiEnvelope, type CouponDetail, type CouponRow, type CouponUsageRow,
} from "./types";

export function CouponDetailDrawer({ coupon, onClose }: { coupon: CouponRow | null; onClose: () => void }) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const open = coupon !== null;
  const couponId = coupon?.id ?? null;

  const [usages, setUsages] = React.useState<CouponUsageRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [now, setNow] = React.useState(0);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Load usage history for the opened coupon (async IIFE — the project's pattern).
  React.useEffect(() => {
    if (!open || !couponId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setUsages([]);
      setNow(Date.now());
      try {
        const res = await fetch(API.admin.coupon(couponId));
        const json = (await res.json()) as ApiEnvelope<CouponDetail>;
        if (!cancelled && res.ok && json.success && json.data) setUsages(json.data.usages ?? []);
      } catch {
        /* history stays empty on a transient failure */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, couponId]);

  const status = coupon ? couponStatus(coupon, now || Date.parse(coupon.validFrom)) : null;
  const remaining = coupon?.usageLimit != null ? Math.max(0, coupon.usageLimit - coupon.usedCount) : null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
      aria-labelledby="coupon-detail-title"
      className="ml-auto h-dvh w-[calc(100vw-2rem)] max-w-lg rounded-none border-l border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      {coupon && status && (
        <div className="flex h-dvh flex-col">
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
            <div className="min-w-0">
              <h2 id="coupon-detail-title" className="flex items-center gap-2 font-mono text-sm font-semibold text-gray-900">
                {coupon.code} <Badge tone={STATUS_META[status].tone}>{STATUS_META[status].label}</Badge>
              </h2>
              {coupon.description && <p className="mt-0.5 truncate text-xs text-gray-500">{coupon.description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"><X className="size-4" /></button>
          </div>

          <div className="flex-1 overflow-auto">
            <Section title="Coupon information">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                <Detail label="Type" value={coupon.type} />
                <Detail label="Value" value={couponValue(coupon)} />
                <Detail label="Applicable to" value={applicableLabel(coupon.applicableTo)} />
                <Detail label="Min order" value={money(coupon.minOrderAmount)} />
                <Detail label="Max discount" value={coupon.maxDiscount != null ? money(coupon.maxDiscount) : "—"} />
              </dl>
            </Section>

            <Section title="Validity">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                <Detail label="Valid from" value={formatDate(coupon.validFrom)} />
                <Detail label="Valid until" value={formatDate(coupon.validUntil)} />
                <Detail label="Status" value={validityText(coupon, now || Date.parse(coupon.validFrom))} />
              </dl>
            </Section>

            <Section title="Usage analytics">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Usage limit" value={coupon.usageLimit != null ? String(coupon.usageLimit) : "∞"} />
                <Stat label="Used" value={String(coupon.usedCount)} />
                <Stat label="Remaining" value={remaining != null ? String(remaining) : "∞"} />
                <Stat label="Customers" value={String(coupon.customersUsed)} />
              </div>
            </Section>

            <div className="px-5 py-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Customer usage history</h3>
              {loading ? (
                <p className="py-6 text-center text-xs text-gray-400">Loading…</p>
              ) : usages.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-400">No usage recorded yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {usages.map((u) => (
                    <li key={u.id} className="flex items-center justify-between rounded border border-gray-100 px-3 py-2 text-xs">
                      <span className="text-gray-700">{`${u.customer.firstName} ${u.customer.lastName ?? ""}`.trim() || "Customer"}</span>
                      <span className="text-gray-500">{money(u.discountAmount)} · {formatDate(u.usedAt)}</span>
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
  return (
    <div className="border-b border-gray-100 px-5 py-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h3>
      {children}
    </div>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-gray-400">{label}</dt><dd className="mt-0.5 font-medium text-gray-800">{value}</dd></div>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded border border-gray-100 p-3"><p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p><p className="mt-1 text-sm font-semibold text-gray-900">{value}</p></div>;
}
