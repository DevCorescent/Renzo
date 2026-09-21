"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlusCircle, X } from "lucide-react";
import { API } from "@/lib/endpoints";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";

const METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "WALLET", label: "Wallet" },
  { value: "GIFT_CARD", label: "Gift card" },
] as const;

type Method = (typeof METHODS)[number]["value"];
type Split = { id: string; method: Method; amount: string; reference: string };

const newSplit = (defaultAmt = ""): Split => ({
  id: Math.random().toString(36).slice(2),
  method: "CASH",
  amount: defaultAmt,
  reference: "",
});

const inputCls = "mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)";

export function CollectPaymentForm({
  invoiceId,
  balanceDue,
}: {
  invoiceId: string;
  balanceDue: number;
}) {
  const router = useRouter();
  const [splits, setSplits] = React.useState<Split[]>([newSplit(String(balanceDue))]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (balanceDue <= 0) return null;

  const totalEntered = splits.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      for (const split of splits) {
        const amt = Number(split.amount);
        if (!(amt > 0)) continue;
        const body: Record<string, unknown> = { method: split.method, amount: amt };
        if (split.reference.trim()) body.reference = split.reference.trim();

        const res = await fetch(API.reception.payment(invoiceId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });
        const j = await res.json().catch(() => null);
        if (!res.ok) {
          const fieldMsg =
            j?.errors && typeof j.errors === "object"
              ? Object.values(j.errors as Record<string, string[]>).flat()[0]
              : null;
          throw new Error(fieldMsg || j?.message || "Payment failed");
        }
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collect payment</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            {splits.map((split, i) => (
              <div key={split.id} className="grid gap-2 grid-cols-[1fr_1fr_1fr_auto] items-end">
                <div>
                  {i === 0 && <p className="mb-1 text-xs text-gray-500">Method</p>}
                  <select
                    value={split.method}
                    onChange={(e) => setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, method: e.target.value as Method } : s))}
                    className={inputCls}
                  >
                    {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  {i === 0 && <p className="mb-1 text-xs text-gray-500">Amount (₹)</p>}
                  <input
                    type="number" min={0.01} step="0.01"
                    value={split.amount}
                    onChange={(e) => setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, amount: e.target.value } : s))}
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  {i === 0 && <p className="mb-1 text-xs text-gray-500">Reference</p>}
                  <input
                    type="text"
                    value={split.reference}
                    onChange={(e) => setSplits(prev => prev.map((s, idx) => idx === i ? { ...s, reference: e.target.value } : s))}
                    placeholder="UPI ref, last 4…"
                    className={inputCls}
                  />
                </div>
                <div className={i === 0 ? "self-end" : ""}>
                  {splits.length > 1 ? (
                    <button type="button" onClick={() => setSplits(prev => prev.filter((_, idx) => idx !== i))}
                      className="inline-flex size-9 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-500">
                      <X className="size-4" />
                    </button>
                  ) : <div className="size-9" />}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSplits(prev => [...prev, newSplit()])}
              className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            >
              <PlusCircle className="size-3.5" /> Add payment method
            </button>
            {splits.length > 1 && totalEntered > 0 && (
              <p className="text-xs text-gray-500">
                Total: ₹{totalEntered.toLocaleString("en-IN")} / ₹{balanceDue.toLocaleString("en-IN")} due
              </p>
            )}
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={busy || !(totalEntered > 0)}
            className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60"
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            Record payment
          </button>
        </form>
      </CardBody>
    </Card>
  );
}
