"use client";

// ============================================================================
// MODULE : Manual Operations — membership sale and loyalty adjustment
//
// Two small counter forms that share the customer picker. Both post to endpoints
// that write through the EXISTING models (CustomerMembership + Invoice, and
// LoyaltyAccount + LoyaltyTransaction), so a membership sold at the desk and one
// bought online are the same record.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Crown, Sparkles } from "lucide-react";
import { API } from "@/lib/endpoints";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/shared/ui";
import { CustomerPicker, type PickedCustomer } from "@/components/operations/customer-picker";
import { EXPENSE_PAYMENT_METHODS, formatMoney, labelise } from "@/lib/operations";

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:focus:border-white/30";
const labelCls = "mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-white/90";

function Banner({ error, success }: { error: string | null; success: string | null }) {
  if (error) {
    return (
      <p className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p className="rounded border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
        {success}
      </p>
    );
  }
  return null;
}

/** Flatten a Zod field-error map into one readable line. */
function flattenErrors(json: { errors?: Record<string, string[]>; message?: string } | null): string {
  if (json?.errors) {
    const flat = Object.values(json.errors).flat().join(" · ");
    if (flat) return flat;
  }
  return json?.message ?? "Something went wrong.";
}

// ============================================================================
// MEMBERSHIP SALE
// ============================================================================

export type PlanOption = {
  id: string;
  name: string;
  tier: string;
  price: number;
  validityDays: number;
  walletCredit: number;
};

export function MembershipSale({ plans }: { plans: PlanOption[] }) {
  const router = useRouter();

  const [customer, setCustomer] = React.useState<PickedCustomer | null>(null);
  const [planId, setPlanId] = React.useState("");
  const [priceOverride, setPriceOverride] = React.useState("");
  const [method, setMethod] = React.useState("CASH");
  const [paid, setPaid] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const plan = plans.find((p) => p.id === planId) ?? null;
  const price = priceOverride.trim() ? Number(priceOverride) : plan?.price ?? 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (!customer) return setError("Choose a customer first.");
    if (!planId) return setError("Choose a plan.");

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const paidValue = Number(paid) || 0;
      const res = await fetch(API.admin.membershipSell, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          planId,
          ...(priceOverride.trim() ? { priceOverride: Number(priceOverride) } : {}),
          ...(paidValue > 0 ? { payments: [{ method, amount: paidValue }] } : {}),
          notes: notes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      setBusy(false);

      if (!res.ok || !json?.success) return setError(flattenErrors(json));

      setSuccess(
        `${json.data.membership.plan.name} activated until ${String(
          json.data.membership.endDate
        ).slice(0, 10)} · invoice ${json.data.invoice.invoiceNo}`
      );
      setCustomer(null);
      setPlanId("");
      setPriceOverride("");
      setPaid("");
      setNotes("");
      router.refresh();
    } catch {
      setBusy(false);
      setError("Network error — please try again.");
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader><CardTitle>Sell a membership</CardTitle></CardHeader>
      <CardBody>
        <form onSubmit={submit} className="space-y-3">
          <Banner error={error} success={success} />

          <CustomerPicker value={customer} onChange={setCustomer} />

          <div>
            <label className={labelCls} htmlFor="mem-plan">Plan</label>
            <select id="mem-plan" value={planId} onChange={(e) => setPlanId(e.target.value)} className={inputCls} required>
              <option value="">Choose a plan…</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {labelise(p.tier)} · {formatMoney(p.price)} · {p.validityDays} days
                </option>
              ))}
            </select>
          </div>

          {plan && (
            <p className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-(--sa-border) dark:bg-white/5 dark:text-(--sa-text-2)">
              Valid {plan.validityDays} days from today
              {plan.walletCredit > 0 ? ` · ${formatMoney(plan.walletCredit)} wallet credit applied on sale` : ""}
              . Activates immediately.
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls} htmlFor="mem-price">Price ₹</label>
              <input id="mem-price" type="number" min={0} step="0.01" value={priceOverride}
                onChange={(e) => setPriceOverride(e.target.value)} className={inputCls}
                placeholder={plan ? String(plan.price) : "List price"} />
            </div>
            <div>
              <label className={labelCls} htmlFor="mem-method">Method</label>
              <select id="mem-method" value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
                {EXPENSE_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{labelise(m)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="mem-paid">Amount collected ₹</label>
            <input id="mem-paid" type="number" min={0} step="0.01" value={paid}
              onChange={(e) => setPaid(e.target.value)} className={inputCls}
              placeholder={price ? String(price) : "0"} />
          </div>

          <div>
            <label className={labelCls} htmlFor="mem-notes">Notes</label>
            <input id="mem-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              className={inputCls} maxLength={500} placeholder="Optional" />
          </div>

          <div className="flex justify-end pt-1">
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Crown className="size-3.5" />}
              {busy ? "Selling…" : "Sell & activate"}
            </button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

// ============================================================================
// LOYALTY ADJUSTMENT
// ============================================================================

export function LoyaltyAdjust() {
  const router = useRouter();

  const [customer, setCustomer] = React.useState<PickedCustomer | null>(null);
  const [direction, setDirection] = React.useState<"ADD" | "DEDUCT">("ADD");
  const [points, setPoints] = React.useState("");
  const [reason, setReason] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (!customer) return setError("Choose a customer first.");
    if (reason.trim().length < 3) return setError("A reason is required.");

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(API.admin.loyaltyAdjust, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          direction,
          points: Number(points),
          reason: reason.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      setBusy(false);

      if (!res.ok || !json?.success) return setError(flattenErrors(json));

      setSuccess(
        `${json.message} · balance ${json.data.balanceBefore} → ${json.data.balanceAfter} (${json.data.tier})`
      );
      setPoints("");
      setReason("");
      router.refresh();
    } catch {
      setBusy(false);
      setError("Network error — please try again.");
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader><CardTitle>Adjust loyalty points</CardTitle></CardHeader>
      <CardBody>
        <form onSubmit={submit} className="space-y-3">
          <Banner error={error} success={success} />

          <CustomerPicker value={customer} onChange={setCustomer} />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls} htmlFor="loy-dir">Direction</label>
              <select id="loy-dir" value={direction}
                onChange={(e) => setDirection(e.target.value as "ADD" | "DEDUCT")} className={inputCls}>
                <option value="ADD">Add points</option>
                <option value="DEDUCT">Deduct points</option>
              </select>
            </div>
            <div>
              <label className={labelCls} htmlFor="loy-points">Points</label>
              <input id="loy-points" type="number" min={1} step={1} required value={points}
                onChange={(e) => setPoints(e.target.value)} className={inputCls} placeholder="0" />
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="loy-reason">
              Reason <span className="text-red-500">*</span>
            </label>
            <input id="loy-reason" required minLength={3} maxLength={300} value={reason}
              onChange={(e) => setReason(e.target.value)} className={inputCls}
              placeholder="e.g. Goodwill for a delayed appointment" />
          </div>

          <p className="text-xs text-gray-400 dark:text-(--sa-muted)">
            Recorded on the customer&apos;s own points ledger as an adjustment, against your name.
            Deducting more than the balance is refused rather than clamped.
          </p>

          <div className="flex justify-end pt-1">
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {busy ? "Saving…" : "Apply adjustment"}
            </button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
