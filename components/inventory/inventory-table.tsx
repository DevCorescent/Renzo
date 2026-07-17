"use client";

// OWNER: Gauransh
// MODULE: Inventory Management

// ============================================================================
// The professional data table. Rows arrive as props from the Server Component
// (already branch-scoped, filtered, sorted and paginated by the stock API) — this
// component adds only interaction: the per-row action menu (View / Edit / Adjust /
// History / Deactivate), the modals/drawers they open, the toast, and URL-driven
// pagination. Status colour is derived from the existing Stock/Product columns
// (out / low / healthy), with a "recently updated" accent for rows touched today.
// ============================================================================

import * as React from "react";
import Image from "next/image";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Check, X, Package } from "lucide-react";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { API } from "@/lib/endpoints";
import { AdjustStockModal } from "./adjust-stock-modal";
import { EditItemModal } from "./edit-item-modal";
import { ItemDetailDrawer } from "./item-detail-drawer";
import { RowActions } from "./row-actions";
import { stockTone, isRecentlyUpdated, type Option, type StockRow, type ApiEnvelope } from "./types";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
function fmtDate(iso: string) {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "—" : new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });
}

export function InventoryTable({
  rows, total, page, limit, totalPages, now, showBranch, canManage, categories, suppliers,
}: {
  rows: StockRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Server-stamped clock — passed down so the "recently updated" accent can't
   *  differ between server and client render (no hydration mismatch). */
  now: number;
  /** Super Admin sees the Branch column; a branch admin's rows are all one branch. */
  showBranch: boolean;
  /** Edit / Deactivate mutate the global Product — shown only where RBAC allows it. */
  canManage: boolean;
  categories: Option[];
  suppliers: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [adjust, setAdjust] = React.useState<StockRow | null>(null);
  const [edit, setEdit] = React.useState<StockRow | null>(null);
  const [detail, setDetail] = React.useState<StockRow | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<StockRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const confirmRef = React.useRef<HTMLDialogElement>(null);
  const confirmOpen = pendingDelete !== null;

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  React.useEffect(() => {
    const el = confirmRef.current;
    if (!el) return;
    if (confirmOpen && !el.open) el.showModal();
    else if (!confirmOpen && el.open) el.close();
  }, [confirmOpen]);

  function goToPage(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(next));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  // Soft-delete through the REUSED DELETE /products/[id] (deactivate). The route is
  // restricted to global roles, matching the menu's canManage gate.
  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(API.admin.product(pendingDelete.productId), { method: "DELETE" });
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !json.success) {
        setToast(json.message || "Could not deactivate item");
        return;
      }
      router.refresh();
      setToast("Item deactivated");
    } catch {
      setToast("Could not reach the server.");
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <>
      {toast && (
        <div role="status" aria-live="polite" className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <p className="flex items-center gap-2 text-xs text-gray-700"><Check className="size-3.5 shrink-0 text-green-600" aria-hidden="true" />{toast}</p>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"><X className="size-3.5" /></button>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>{total} {total === 1 ? "item" : "items"}</CardTitle></CardHeader>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-gray-50 text-gray-300 ring-1 ring-gray-200"><Package className="size-5" /></span>
            <p className="mt-3 text-sm font-medium text-gray-700">No inventory matches your filters</p>
          </div>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Product</TH><TH>SKU</TH><TH>Category</TH><TH>Supplier</TH>
                {showBranch && <TH>Branch</TH>}
                <TH className="text-right">On hand</TH><TH className="text-right">Reserved</TH><TH className="text-right">Available</TH>
                <TH className="text-right">Reorder</TH><TH className="text-right">Purchase</TH><TH className="text-right">Selling</TH>
                <TH>Status</TH><TH>Updated</TH><TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((r) => {
                const st = stockTone(r);
                const recent = isRecentlyUpdated(r.updatedAt, now);
                return (
                  <TR key={r.id}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <span className="relative size-9 shrink-0 overflow-hidden rounded bg-gray-100 ring-1 ring-gray-200">
                          {r.product.image ? (
                            <Image src={r.product.image} alt="" fill sizes="36px" className="object-cover" />
                          ) : (
                            <span className="flex size-full items-center justify-center text-gray-300"><Package className="size-4" /></span>
                          )}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900">{r.product.name}</p>
                          {r.product.brand && <p className="truncate text-[11px] text-gray-400">{r.product.brand}</p>}
                        </div>
                      </div>
                    </TD>
                    <TD className="font-mono text-xs text-gray-600">{r.product.sku}</TD>
                    <TD className="text-xs text-gray-500">{r.product.category?.name ?? "—"}</TD>
                    <TD className="text-xs text-gray-500">{r.product.supplier?.name ?? "—"}</TD>
                    {showBranch && <TD className="text-xs text-gray-500">{r.branch.name}</TD>}
                    <TD className="text-right text-gray-800">{r.quantity} <span className="text-[11px] text-gray-400">{r.product.unit}</span></TD>
                    <TD className="text-right text-gray-500">{r.reservedQty}</TD>
                    <TD className="text-right font-medium text-gray-900">{r.availableQty}</TD>
                    <TD className="text-right text-gray-500">{r.product.reorderLevel}</TD>
                    <TD className="text-right text-xs text-gray-500">{money(r.product.purchasePrice)}</TD>
                    <TD className="text-right text-xs text-gray-700">{money(r.product.sellingPrice)}</TD>
                    <TD>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={r.product.isActive ? st.tone : "neutral"}>{r.product.isActive ? st.label : "Inactive"}</Badge>
                        {recent && <Badge tone="info">Updated</Badge>}
                      </div>
                    </TD>
                    <TD className="whitespace-nowrap text-xs text-gray-500">{fmtDate(r.updatedAt)}</TD>
                    <TD className="text-right">
                      <RowActions
                        row={r}
                        canManage={canManage}
                        onView={setDetail}
                        onAdjust={setAdjust}
                        onHistory={setDetail}
                        onEdit={setEdit}
                        onDelete={setPendingDelete}
                      />
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
            <span>{from}–{to} of {total}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => goToPage(page - 1)} disabled={page <= 1} className="rounded border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 disabled:opacity-40">Previous</button>
              <button type="button" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} className="rounded border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </Card>

      <AdjustStockModal row={adjust} onClose={() => setAdjust(null)} onDone={(m) => { setAdjust(null); setToast(m); }} />
      <EditItemModal row={edit} onClose={() => setEdit(null)} onDone={(m) => { setEdit(null); setToast(m); }} categories={categories} suppliers={suppliers} />
      <ItemDetailDrawer row={detail} onClose={() => setDetail(null)} />

      {/* Deactivate confirm — soft, reversible, so a single confirmation is enough. */}
      <dialog
        ref={confirmRef}
        onCancel={(e) => { e.preventDefault(); if (!deleting) setPendingDelete(null); }}
        onClick={(e) => { if (e.target === confirmRef.current && !deleting) setPendingDelete(null); }}
        className="w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
      >
        {pendingDelete && (
          <div className="p-5">
            <h2 className="text-sm font-semibold text-gray-900">Deactivate item</h2>
            <p className="mt-1 text-xs text-gray-500">
              Deactivate <span className="font-medium text-gray-700">{pendingDelete.product.name}</span>? It will be hidden from active inventory but its history is kept.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setPendingDelete(null)} disabled={deleting} className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={deleting} className="inline-flex h-9 items-center rounded bg-red-600 px-4 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60">{deleting ? "Deactivating…" : "Deactivate"}</button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
