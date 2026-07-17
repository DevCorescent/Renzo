"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";

const METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "WALLET", label: "Wallet" },
  { value: "GIFT_CARD", label: "Gift card" },
] as const;

type Method = (typeof METHODS)[number]["value"];

export function CollectPaymentForm({
  invoiceId,
  balanceDue,
}: {
  invoiceId: string;
  balanceDue: number;
}) {
  const router = useRouter();
  const [method, setMethod] = React.useState<Method>("CASH");
  const [amount, setAmount] = React.useState(String(balanceDue));
  const [reference, setReference] = React.useState("");
  const [giftCardCode, setGiftCardCode] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (balanceDue <= 0) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        method,
        amount: Number(amount),
      };
      if (reference.trim()) body.reference = reference.trim();
      if (notes.trim()) body.notes = notes.trim();
      if (method === "GIFT_CARD") body.giftCardCode = giftCardCode.trim();

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
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-gray-500">
              Method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as Method)}
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-gray-500">
              Amount
              <input
                type="number"
                min={0.01}
                step="0.01"
                max={balanceDue}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
              />
            </label>
          </div>

          {method === "GIFT_CARD" && (
            <label className="block text-xs text-gray-500">
              Gift card code
              <input
                type="text"
                value={giftCardCode}
                onChange={(e) => setGiftCardCode(e.target.value)}
                required
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
              />
            </label>
          )}

          {(method === "UPI" || method === "CASH") && (
            <label className="block text-xs text-gray-500">
              Reference <span className="text-gray-400">(optional)</span>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
              />
            </label>
          )}

          <label className="block text-xs text-gray-500">
            Notes <span className="text-gray-400">(optional)</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-400"
            />
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={busy}
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
