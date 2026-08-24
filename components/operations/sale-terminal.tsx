"use client";

// ============================================================================
// MODULE : Manual Operations — direct sale terminal
//
// Sell products and services with no appointment. Posts to /reception/sale,
// which writes the same Invoice, InvoiceItem, Payment, StockMovement and loyalty
// rows the appointment path writes.
//
// The running total is computed here for feedback while typing, but the SERVER
// recomputes every figure from the catalogue — a price typed into the browser is
// never trusted, and a line's unit price is only honoured as an explicit override.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, ShoppingBag, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { API } from "@/lib/endpoints";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/shared/ui";
import { CustomerPicker, type PickedCustomer } from "@/components/operations/customer-picker";
import { EXPENSE_PAYMENT_METHODS, formatMoney, labelise } from "@/lib/operations";

export type CatalogueItem = {
  id: string;
  name: string;
  price: number;
  kind: "PRODUCT" | "SERVICE";
  /** Present for products so the terminal can warn before the server refuses. */
  stock?: number;
};

type Line = {
  key: string;
  kind: "PRODUCT" | "SERVICE" | "MISC";
  id: string;
  quantity: number;
  unitPrice: number;
  /** MISC only — a free-text charge has no catalogue entry to take a name from. */
  name?: string;
};

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:focus:border-white/30";
const labelCls = "mb-1 block text-xs font-medium text-gray-600 dark:text-(--sa-text-2)";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-white/90";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-white/5";

const round2 = (n: number) => Math.round(n * 100) / 100;

export function SaleTerminal({
  catalogue,
  taxPercent,
  taxName,
  branches,
  canChooseBranch,
}: {
  catalogue: CatalogueItem[];
  /** The branch's live rate. The SERVER applies it; this only previews it. */
  taxPercent: number;
  taxName: string;
  /** Populated only for a platform role, who has no branch of their own. */
  branches: { id: string; name: string }[];
  canChooseBranch: boolean;
}) {
  const router = useRouter();

  const [branchId, setBranchId] = React.useState("");
  const [customer, setCustomer] = React.useState<PickedCustomer | null>(null);
  const [lines, setLines] = React.useState<Line[]>([]);
  const [discount, setDiscount] = React.useState("");
  const [tip, setTip] = React.useState("");
  const [payMethod, setPayMethod] = React.useState<string>("CASH");
  const [payAmount, setPayAmount] = React.useState("");
  const [payReference, setPayReference] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [catalogueQuery, setCatalogueQuery] = React.useState("");

  const [busy, setBusy] = React.useState(false);
  const [banner, setBanner] = React.useState<string | null>(null);
  const [okMessage, setOkMessage] = React.useState<string | null>(null);

  const byId = React.useMemo(
    () => new Map(catalogue.map((c) => [c.id, c])),
    [catalogue]
  );

  const num = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const subtotal = round2(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
  const discountValue = Math.min(num(discount), subtotal);
  const taxable = Math.max(0, subtotal - discountValue);
  // Same order the server uses: discount off the subtotal, tax on the remainder,
  // tip added afterwards untaxed. See computeInvoiceTotals in lib/billing-service.
  const taxValue = round2((taxable * taxPercent) / 100);
  const total = round2(taxable + taxValue + num(tip));

  function addLine(id: string) {
    const item = byId.get(id);
    if (!item) return;
    setLines((prev) => {
      // Same item twice bumps the quantity rather than making a second row —
      // a receptionist scanning two of the same bottle expects qty 2.
      const existing = prev.find((l) => l.id === id);
      if (existing) {
        return prev.map((l) => (l.id === id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        {
          key: `${id}-${prev.length}`,
          kind: item.kind,
          id,
          quantity: 1,
          unitPrice: item.price,
        },
      ];
    });
  }

  function patchLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  /** A consultation, a sundry charge — anything with no catalogue entry. */
  function addMiscLine() {
    setLines((prev) => [
      ...prev,
      {
        key: `misc-${prev.length}-${prev.length ? prev[prev.length - 1].key : "0"}`,
        kind: "MISC",
        id: "",
        quantity: 1,
        unitPrice: 0,
        name: "",
      },
    ]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (canChooseBranch && !branchId) {
      setBanner("Choose which branch this bill belongs to.");
      return;
    }
    if (!customer) {
      setBanner("Choose a customer first.");
      return;
    }
    if (lines.length === 0) {
      setBanner("Add at least one product, service or charge.");
      return;
    }

    const badMisc = lines.find((l) => l.kind === "MISC" && !l.name?.trim());
    if (badMisc) {
      setBanner("Give every miscellaneous charge a description.");
      return;
    }

    const paid = num(payAmount);
    if (paid > total) {
      setBanner(`Payment ${formatMoney(paid)} is more than the total ${formatMoney(total)}.`);
      return;
    }

    setBusy(true);
    setBanner(null);
    setOkMessage(null);

    try {
      const res = await fetch(API.reception.sale, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer.id,
          // Ignored by the server for a branch-scoped caller, who is pinned to
          // their own branch regardless of what is sent.
          ...(canChooseBranch && branchId ? { branchId } : {}),
          lines: lines.map((l) => ({
            kind: l.kind,
            ...(l.kind === "MISC" ? { name: l.name?.trim() } : { id: l.id }),
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
          ...(discountValue > 0 ? { discountAmount: discountValue } : {}),
          // Tax is NOT sent: the server takes it from the branch's own setting so
          // a tampered request cannot change what GST is charged.
          ...(num(tip) > 0 ? { tipAmount: num(tip) } : {}),
          ...(paid > 0
            ? {
                payments: [
                  {
                    method: payMethod,
                    amount: paid,
                    ...(payReference.trim() ? { reference: payReference.trim() } : {}),
                  },
                ],
              }
            : {}),
          notes: notes.trim() || null,
        }),
      });

      const json = await res.json().catch(() => null);
      setBusy(false);

      if (!res.ok || !json?.success) {
        const fieldErrors = json?.errors
          ? Object.values(json.errors as Record<string, string[]>).flat().join(" · ")
          : "";
        setBanner(fieldErrors || json?.message || "Could not record the sale.");
        return;
      }

      setOkMessage(`Invoice ${json.data.invoiceNo} raised for ${formatMoney(json.data.totalAmount)}.`);
      setLines([]);
      setDiscount("");
      setTip("");
      setPayAmount("");
      setPayReference("");
      setNotes("");
      router.refresh();
    } catch {
      setBusy(false);
      setBanner("Network error — please try again.");
    }
  }

  const catalogueNeedle = catalogueQuery.trim().toLowerCase();
  const products = catalogue.filter(
    (c) =>
      c.kind === "PRODUCT" &&
      (!catalogueNeedle || c.name.toLowerCase().includes(catalogueNeedle)),
  );
  const services = catalogue.filter(
    (c) =>
      c.kind === "SERVICE" &&
      (!catalogueNeedle || c.name.toLowerCase().includes(catalogueNeedle)),
  );

  return (
    <form onSubmit={submit} className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            {canChooseBranch && (
              <div>
                <label className={labelCls} htmlFor="sale-branch">
                  Branch <span className="text-red-500">*</span>
                </label>
                <select
                  id="sale-branch"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className={inputCls}
                  required
                >
                  <option value="">Choose a branch…</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-gray-400 dark:text-(--sa-muted)">
                  Stock and tax are taken from this branch.
                </p>
              </div>
            )}
            <CustomerPicker value={customer} onChange={setCustomer} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Items</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <label className="block">
              <span className={labelCls}>Search catalogue</span>
              <input
                type="search"
                value={catalogueQuery}
                onChange={(e) => setCatalogueQuery(e.target.value)}
                placeholder="Filter products and services…"
                className={inputCls}
              />
              {catalogueNeedle && (
                <p className="mt-1 text-[11px] text-gray-400 dark:text-(--sa-muted)">
                  {products.length + services.length} match
                  {products.length + services.length === 1 ? "" : "es"}
                  {products.length + services.length === 0 ? " — try another term" : ""}
                </p>
              )}
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className={labelCls} htmlFor="add-product">Add product</label>
                <select
                  id="add-product"
                  value=""
                  onChange={(e) => e.target.value && addLine(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Choose a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id} disabled={(p.stock ?? 0) <= 0}>
                      {p.name} — {formatMoney(p.price)}
                      {p.stock !== undefined ? ` (${p.stock} in stock)` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} htmlFor="add-service">Add service</label>
                <select
                  id="add-service"
                  value=""
                  onChange={(e) => e.target.value && addLine(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Choose a service…</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {formatMoney(s.price)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button type="button" onClick={addMiscLine} className={btnGhost}>
              <Plus className="size-3.5" aria-hidden="true" /> Add a custom charge
            </button>

            {lines.length === 0 ? (
              <p className="rounded border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-gray-400 dark:border-(--sa-border) dark:text-(--sa-muted)">
                No items yet. Add a product, service or custom charge above.
              </p>
            ) : (
              <ul className="space-y-2">
                {lines.map((line) => {
                  const item = byId.get(line.id);
                  const overStock =
                    line.kind === "PRODUCT" &&
                    item?.stock !== undefined &&
                    line.quantity > item.stock;

                  return (
                    <li
                      key={line.key}
                      className="flex flex-wrap items-end gap-2 rounded border border-gray-100 p-2.5 dark:border-(--sa-border)"
                    >
                      <span className="min-w-32 flex-1">
                        {line.kind === "MISC" ? (
                          <input
                            aria-label="Charge description"
                            value={line.name ?? ""}
                            onChange={(e) => patchLine(line.key, { name: e.target.value })}
                            placeholder="e.g. Consultation"
                            maxLength={120}
                            className={inputCls}
                          />
                        ) : (
                          <span className="block text-sm text-gray-800 dark:text-(--sa-text)">
                            {item?.name ?? line.id}
                          </span>
                        )}
                        <span className="block text-[11px] text-gray-400 dark:text-(--sa-muted)">
                          {labelise(line.kind)}
                          {overStock ? ` · only ${item?.stock} in stock` : ""}
                        </span>
                      </span>

                      <span className="w-20">
                        <label className={labelCls} htmlFor={`qty-${line.key}`}>Qty</label>
                        <input
                          id={`qty-${line.key}`}
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) =>
                            patchLine(line.key, { quantity: Math.max(1, Number(e.target.value) || 1) })
                          }
                          className={cn(inputCls, overStock && "border-red-400")}
                        />
                      </span>

                      <span className="w-28">
                        <label className={labelCls} htmlFor={`price-${line.key}`}>Unit price</label>
                        <input
                          id={`price-${line.key}`}
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) =>
                            patchLine(line.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                          }
                          className={inputCls}
                        />
                      </span>

                      <span className="w-24 text-right text-sm font-medium text-gray-800 dark:text-(--sa-text)">
                        {formatMoney(line.unitPrice * line.quantity)}
                      </span>

                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                        aria-label="Remove item"
                        className="rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Totals and payment ───────────────────────────────────────────── */}
      <Card className="h-fit">
        <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          {banner && (
            <p className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {banner}
            </p>
          )}
          {okMessage && (
            <p className="rounded border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              {okMessage}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls} htmlFor="sale-discount">Discount ₹</label>
              <input id="sale-discount" type="number" min={0} step="0.01" value={discount}
                onChange={(e) => setDiscount(e.target.value)} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls} htmlFor="sale-tax">{taxName}</label>
              <input
                id="sale-tax"
                value={`${taxPercent}%`}
                readOnly
                disabled
                title="Set on the branch, not per bill"
                className={cn(inputCls, "bg-gray-50 text-gray-500 dark:bg-white/5")}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="sale-tip">Tip ₹</label>
              <input id="sale-tip" type="number" min={0} step="0.01" value={tip}
                onChange={(e) => setTip(e.target.value)} className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls} htmlFor="sale-method">Method</label>
              <select id="sale-method" value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={inputCls}>
                {EXPENSE_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{labelise(m)}</option>
                ))}
                <option value="WALLET">Wallet</option>
                <option value="GIFT_CARD">Gift Card</option>
              </select>
            </div>
          </div>

          <dl className="space-y-1 border-t border-gray-100 pt-2 text-xs dark:border-(--sa-border)">
            <div className="flex justify-between"><dt className="text-gray-500 dark:text-(--sa-text-2)">Subtotal</dt><dd className="text-gray-800 dark:text-(--sa-text)">{formatMoney(subtotal)}</dd></div>
            {discountValue > 0 && <div className="flex justify-between"><dt className="text-gray-500 dark:text-(--sa-text-2)">Discount</dt><dd className="text-gray-800 dark:text-(--sa-text)">− {formatMoney(discountValue)}</dd></div>}
            {taxValue > 0 && <div className="flex justify-between"><dt className="text-gray-500 dark:text-(--sa-text-2)">{taxName} ({taxPercent}%)</dt><dd className="text-gray-800 dark:text-(--sa-text)">{formatMoney(taxValue)}</dd></div>}
            {num(tip) > 0 && <div className="flex justify-between"><dt className="text-gray-500 dark:text-(--sa-text-2)">Tip</dt><dd className="text-gray-800 dark:text-(--sa-text)">{formatMoney(num(tip))}</dd></div>}
            <div className="flex justify-between border-t border-gray-100 pt-1 text-sm font-semibold dark:border-(--sa-border)">
              <dt className="text-gray-700 dark:text-(--sa-text)">Total</dt>
              <dd className="text-gray-900 dark:text-(--sa-text)">{formatMoney(total)}</dd>
            </div>
          </dl>

          <div>
            <label className={labelCls} htmlFor="sale-paid">Amount collected ₹</label>
            <input id="sale-paid" type="number" min={0} step="0.01" value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)} className={inputCls}
              placeholder={String(total)} />
            <p className="mt-1 text-[11px] text-gray-400 dark:text-(--sa-muted)">
              Leave blank or pay less for a partial payment — the balance stays due on the invoice.
            </p>
          </div>

          <div>
            <label className={labelCls} htmlFor="sale-ref">Reference</label>
            <input id="sale-ref" value={payReference} onChange={(e) => setPayReference(e.target.value)}
              className={inputCls} placeholder="UPI ref, last 4 digits…" maxLength={80} />
          </div>

          <div>
            <label className={labelCls} htmlFor="sale-notes">Notes</label>
            <input id="sale-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              className={inputCls} maxLength={500} placeholder="Optional" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setLines([]); setCustomer(null); }} className={btnGhost}>
              Clear
            </button>
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShoppingBag className="size-3.5" />}
              {busy ? "Recording…" : "Record sale"}
            </button>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}
