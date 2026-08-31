"use client";

// Quick-bill an appointment straight from the billing desk. Opens inline on the
// unbilled row: the booked services are shown as-is, and the operator can SEARCH
// the catalogue to add a service the customer also took, or drop in a custom
// charge, before generating the invoice — so a bill is never a dead end when the
// booking missed something. Final tax/discount are applied server-side; the
// figure here is a pre-tax preview.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, X, FileText, Loader2 } from "lucide-react";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";

export type CatalogueItem = {
  id: string;
  name: string;
  price: number;
  kind: "SERVICE" | "PRODUCT";
  /** Per-branch stock for products; null when unknown (a platform role) or n/a. */
  stock?: number | null;
};

type ExtraItem = { id: string; name: string; price: number; qty: number; kind: "SERVICE" | "PRODUCT" };
type MiscLine = { key: string; name: string; price: number };

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:focus:border-white/30";

export function AppointmentBill({
  appointmentId,
  basePath,
  catalogue,
  bookedServices,
  bookedTotal,
}: {
  appointmentId: string;
  basePath: string;
  catalogue: CatalogueItem[];
  /** Human-readable list of what was booked, for display only. */
  bookedServices: string;
  /** Pre-tax total of the booked services. */
  bookedTotal: number;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");
  const [extras, setExtras] = React.useState<ExtraItem[]>([]);
  const [misc, setMisc] = React.useState<MiscLine[]>([]);
  const [miscOpen, setMiscOpen] = React.useState(false);
  const [miscName, setMiscName] = React.useState("");
  const [miscPrice, setMiscPrice] = React.useState("");

  const needle = query.trim().toLowerCase();
  const results = React.useMemo(() => {
    if (!needle) return [];
    return catalogue.filter((c) => c.name.toLowerCase().includes(needle)).slice(0, 8);
  }, [catalogue, needle]);

  const extrasTotal = extras.reduce((s, e) => s + e.price * e.qty, 0);
  const miscTotal = misc.reduce((s, m) => s + m.price, 0);
  const previewTotal = bookedTotal + extrasTotal + miscTotal;

  function addItem(item: CatalogueItem) {
    setExtras((prev) => {
      const hit = prev.find((e) => e.id === item.id);
      if (hit) return prev.map((e) => (e.id === item.id ? { ...e, qty: e.qty + 1 } : e));
      return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1, kind: item.kind }];
    });
    setQuery("");
  }

  function setQty(id: string, qty: number) {
    setExtras((prev) =>
      qty <= 0 ? prev.filter((e) => e.id !== id) : prev.map((e) => (e.id === id ? { ...e, qty } : e)),
    );
  }

  function addMisc() {
    const name = miscName.trim();
    const price = Number(miscPrice);
    if (!name || !Number.isFinite(price) || price < 0) return;
    setMisc((prev) => [...prev, { key: `${name}-${prev.length}`, name, price }]);
    setMiscName("");
    setMiscPrice("");
    setMiscOpen(false);
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const extraLines = [
        ...extras.map((e) => ({ kind: e.kind, id: e.id, quantity: e.qty })),
        ...misc.map((m) => ({ kind: "MISC" as const, name: m.name, unitPrice: m.price, quantity: 1 })),
      ];
      const res = await fetch(API.reception.billing, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ appointmentId, ...(extraLines.length ? { extraLines } : {}) }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.message ?? "Could not generate invoice");
      const invoiceId = j?.data?.id as string | undefined;
      if (invoiceId) {
        router.push(`${basePath}/${invoiceId}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate invoice");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 transition hover:border-gray-300 hover:bg-gray-50 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)"
        >
          <FileText className="size-3" aria-hidden />
          Bill
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-2.5 rounded-lg border border-gray-200 bg-gray-50/60 p-3 text-left dark:border-(--sa-border) dark:bg-(--sa-surface)">
      {/* Booked services (read-only) */}
      <div className="text-xs text-gray-600 dark:text-(--sa-text-2)">
        <span className="font-medium text-gray-800 dark:text-(--sa-text)">Booked: </span>
        {bookedServices || "—"}
      </div>

      {/* Search + add services */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a service or product…"
          className={cn(inputCls, "pl-8")}
        />
        {results.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg dark:border-(--sa-border) dark:bg-(--sa-surface)">
            {results.map((r) => {
              const isProduct = r.kind === "PRODUCT";
              const outOfStock = isProduct && r.stock !== null && r.stock !== undefined && r.stock <= 0;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => addItem(r)}
                    disabled={outOfStock}
                    className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-(--sa-text) dark:hover:bg-white/5"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{r.name}</span>
                      {isProduct && (
                        <span className="shrink-0 rounded bg-gray-100 px-1 text-[10px] font-medium text-gray-500 dark:bg-white/10 dark:text-(--sa-text-2)">
                          {outOfStock ? "Out of stock" : r.stock !== null && r.stock !== undefined ? `${r.stock} in stock` : "Product"}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-gray-400">{money(r.price)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Added extra lines */}
      {(extras.length > 0 || misc.length > 0) && (
        <ul className="space-y-1">
          {extras.map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-xs">
              <span className="flex-1 truncate text-gray-700 dark:text-(--sa-text)">{e.name}</span>
              <div className="flex items-center rounded border border-gray-200 dark:border-(--sa-border)">
                <button type="button" onClick={() => setQty(e.id, e.qty - 1)} className="px-1.5 text-gray-500 hover:text-gray-900" aria-label="Decrease">−</button>
                <span className="min-w-5 text-center tabular-nums">{e.qty}</span>
                <button type="button" onClick={() => setQty(e.id, e.qty + 1)} className="px-1.5 text-gray-500 hover:text-gray-900" aria-label="Increase">+</button>
              </div>
              <span className="w-16 text-right tabular-nums text-gray-600 dark:text-(--sa-text-2)">{money(e.price * e.qty)}</span>
              <button type="button" onClick={() => setQty(e.id, 0)} aria-label="Remove" className="text-gray-400 hover:text-red-500">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
          {misc.map((m) => (
            <li key={m.key} className="flex items-center gap-2 text-xs">
              <span className="flex-1 truncate text-gray-700 dark:text-(--sa-text)">{m.name}</span>
              <span className="w-16 text-right tabular-nums text-gray-600 dark:text-(--sa-text-2)">{money(m.price)}</span>
              <button type="button" onClick={() => setMisc((prev) => prev.filter((x) => x.key !== m.key))} aria-label="Remove" className="text-gray-400 hover:text-red-500">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Misc charge adder */}
      {miscOpen ? (
        <div className="flex items-center gap-1.5">
          <input value={miscName} onChange={(e) => setMiscName(e.target.value)} placeholder="Custom charge" className={cn(inputCls, "flex-1")} />
          <input value={miscPrice} onChange={(e) => setMiscPrice(e.target.value)} type="number" min={0} step="0.01" placeholder="₹" className={cn(inputCls, "w-20")} />
          <button type="button" onClick={addMisc} className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-100 dark:border-(--sa-border) dark:hover:bg-white/5">Add</button>
        </div>
      ) : (
        <button type="button" onClick={() => setMiscOpen(true)} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:text-(--sa-text-2)">
          <Plus className="size-3" /> Custom charge
        </button>
      )}

      {/* Total + actions */}
      <div className="flex items-center justify-between border-t border-gray-200 pt-2 dark:border-(--sa-border)">
        <span className="text-xs text-gray-500 dark:text-(--sa-text-2)">Subtotal (pre-tax)</span>
        <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-(--sa-text)">{money(previewTotal)}</span>
      </div>

      {error && <p className="text-[11px] text-red-500">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} disabled={busy} className="rounded-md px-2 py-1 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-60 dark:text-(--sa-text-2)">
          Cancel
        </button>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-white/90"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
          Generate invoice
        </button>
      </div>
    </div>
  );
}
