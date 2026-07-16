"use client";

// OWNER: Gauransh
// MODULE: Inventory Management

import * as React from "react";
import { X, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { API } from "@/lib/endpoints";
import { Badge } from "@/components/shared/ui";
import { stockTone, type MovementRow, type StockRow, type Paginated, type ApiEnvelope } from "./types";

// One right-side drawer backs both "View details" and "Stock history": the header
// summarises the (already-loaded) row, and the body streams the StockMovement ledger
// from the REUSE-friendly new GET .../stock/movements endpoint. The endpoint is
// branch-scoped server-side, so passing the row's branchId narrows a global caller's
// view and is simply ignored for a branch admin (pinned to their own branch).

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
function fmtDateTime(iso: string) {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "—" : new Date(ms).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

const MOVEMENT_LABEL: Record<string, string> = {
  PURCHASE_IN: "Purchase in", TRANSFER_IN: "Transfer in", TRANSFER_OUT: "Transfer out",
  ADJUSTMENT: "Adjustment", DAMAGE: "Damage", EXPIRY: "Expiry", SERVICE_USE: "Service use", RETAIL_SALE: "Retail sale",
};

export function ItemDetailDrawer({ row, onClose }: { row: StockRow | null; onClose: () => void }) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const open = row !== null;

  const [movements, setMovements] = React.useState<MovementRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Load the ledger whenever a new row is opened (async IIFE — the project's pattern
  // for effect fetches).
  const productId = row?.productId ?? null;
  const branchId = row?.branchId ?? null;
  React.useEffect(() => {
    if (!productId || !branchId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setMovements([]);
      try {
        const url = `${API.admin.stockMovements}?productId=${encodeURIComponent(productId)}&branchId=${encodeURIComponent(branchId)}&limit=50`;
        const res = await fetch(url);
        const json = (await res.json()) as ApiEnvelope<Paginated<MovementRow>>;
        if (cancelled) return;
        if (res.ok && json.success && json.data) setMovements(json.data.items);
        else setError(json.message || "Could not load history");
      } catch {
        if (!cancelled) setError("Could not reach the server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId, branchId]);

  const st = row ? stockTone(row) : null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
      aria-labelledby="item-drawer-title"
      className="ml-auto h-dvh w-[calc(100vw-2rem)] max-w-md rounded-none border-l border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      {row && (
        <div className="flex h-dvh flex-col">
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
            <div className="min-w-0">
              <h2 id="item-drawer-title" className="truncate text-sm font-semibold text-gray-900">{row.product.name}</h2>
              <p className="mt-0.5 font-mono text-xs text-gray-500">{row.product.sku}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10">
              <X className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {/* Snapshot — everything here comes from the already-loaded row (no fetch). */}
            <div className="space-y-3 border-b border-gray-100 px-5 py-4">
              <div className="flex items-center justify-between">
                {st && <Badge tone={st.tone}>{st.label}</Badge>}
                <span className="text-xs text-gray-400">{row.branch.name}</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <Detail label="On hand" value={`${row.quantity} ${row.product.unit}`} />
                <Detail label="Reserved" value={`${row.reservedQty} ${row.product.unit}`} />
                <Detail label="Available" value={`${row.availableQty} ${row.product.unit}`} />
                <Detail label="Reorder level" value={String(row.product.reorderLevel)} />
                <Detail label="Purchase price" value={money(row.product.purchasePrice)} />
                <Detail label="Selling price" value={money(row.product.sellingPrice)} />
                <Detail label="Category" value={row.product.category?.name ?? "—"} />
                <Detail label="Supplier" value={row.product.supplier?.name ?? "—"} />
              </dl>
            </div>

            {/* Ledger */}
            <div className="px-5 py-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Stock history</h3>
              {loading ? (
                <p className="py-6 text-center text-xs text-gray-400">Loading history…</p>
              ) : error ? (
                <p className="py-6 text-center text-xs text-red-600">{error}</p>
              ) : movements.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-400">No stock movements recorded yet.</p>
              ) : (
                <ol className="space-y-2">
                  {movements.map((m) => {
                    const inbound = m.balanceAfter >= m.balanceBefore;
                    return (
                      <li key={m.id} className="flex items-start gap-2.5 rounded border border-gray-100 px-3 py-2">
                        <span className={inbound ? "mt-0.5 text-green-600" : "mt-0.5 text-red-500"} aria-hidden="true">
                          {inbound ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-gray-800">{MOVEMENT_LABEL[m.type] ?? m.type}</span>
                            <span className={inbound ? "text-xs font-medium text-green-600" : "text-xs font-medium text-red-500"}>
                              {inbound ? "+" : "−"}{m.quantity} {row.product.unit}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-gray-400">
                            {fmtDateTime(m.createdAt)} · {m.performedByName} · balance {m.balanceAfter}
                          </p>
                          {m.notes && <p className="mt-0.5 text-[11px] text-gray-500">{m.notes}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-gray-800">{value}</dd>
    </div>
  );
}
