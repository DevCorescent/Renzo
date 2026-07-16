"use client";

// OWNER: Gauransh
// MODULE: Inventory Management

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import type { ApiEnvelope, Option, StockRow } from "./types";

// Editing an item mutates the (global) Product master through the REUSED
// PATCH /products/[id] route — the same route restricts itself to global roles, so
// this modal is only ever surfaced on the Super Admin page. SKU and per-branch stock
// are intentionally NOT editable here (stock changes go through Adjust).

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:bg-gray-50";
const invalidCls = "border-red-300 focus:border-red-400 focus:ring-red-500/10";
const labelCls = "block text-xs font-medium text-gray-700";

// Shape of the fields we read back from GET /products/[id] to prefill the form.
type ProductDetail = {
  name: string; brand: string | null; description: string | null;
  categoryId: string | null; supplierId: string | null;
  purchasePrice: number; sellingPrice: number; reorderLevel: number;
  isRetail: boolean; isActive: boolean;
};

export function EditItemModal({
  row,
  onClose,
  onDone,
  categories,
  suppliers,
}: {
  row: StockRow | null;
  onClose: () => void;
  onDone: (message: string) => void;
  categories: Option[];
  suppliers: Option[];
}) {
  const router = useRouter();
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const open = row !== null;

  const [loading, setLoading] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "", brand: "", description: "", categoryId: "", supplierId: "",
    purchasePrice: "", sellingPrice: "", reorderLevel: "", isRetail: false, isActive: true,
  });
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key as string] ? { ...e, [key as string]: [] } : e));
  };

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Load the authoritative product on open so category/supplier (ids absent from the
  // row) and brand/description prefill correctly. Async IIFE inside the effect is the
  // project's accepted pattern for effect fetches.
  const productId = row?.productId ?? null;
  React.useEffect(() => {
    if (!productId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErrors({});
      setFormError(null);
      try {
        const res = await fetch(API.admin.product(productId));
        const json = (await res.json()) as ApiEnvelope<ProductDetail>;
        if (cancelled) return;
        if (res.ok && json.success && json.data) {
          const p = json.data;
          setForm({
            name: p.name ?? "",
            brand: p.brand ?? "",
            description: p.description ?? "",
            categoryId: p.categoryId ?? "",
            supplierId: p.supplierId ?? "",
            purchasePrice: String(p.purchasePrice ?? 0),
            sellingPrice: String(p.sellingPrice ?? 0),
            reorderLevel: String(p.reorderLevel ?? 0),
            isRetail: Boolean(p.isRetail),
            isActive: Boolean(p.isActive),
          });
        } else {
          setFormError(json.message || "Could not load this product");
        }
      } catch {
        if (!cancelled) setFormError("Could not reach the server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!row || submitting) return;
    if (!form.name.trim()) {
      setErrors({ name: ["Product name is required"] });
      return;
    }
    setErrors({});
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await fetch(API.admin.product(row.productId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          brand: form.brand.trim(),
          description: form.description.trim(),
          categoryId: form.categoryId,
          supplierId: form.supplierId,
          purchasePrice: Number(form.purchasePrice) || 0,
          sellingPrice: Number(form.sellingPrice) || 0,
          reorderLevel: Number(form.reorderLevel) || 0,
          isRetail: form.isRetail,
          isActive: form.isActive,
        }),
      });
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !json.success) {
        if (json.errors) setErrors(json.errors);
        else setFormError(json.message || "Could not save changes");
        return;
      }
    } catch {
      setFormError("Could not reach the server. Please try again.");
      return;
    } finally {
      setSubmitting(false);
    }
    router.refresh();
    onDone("Item updated");
  }

  const busy = submitting || loading;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current && !busy) onClose(); }}
      aria-labelledby="edit-item-title"
      className="w-[calc(100vw-2rem)] max-w-lg rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      {row && (
        <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
            <div className="min-w-0">
              <h2 id="edit-item-title" className="truncate text-sm font-semibold text-gray-900">Edit item — {row.product.name}</h2>
              <p className="mt-0.5 font-mono text-xs text-gray-500">{row.product.sku}</p>
            </div>
            <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50">
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-4 overflow-y-auto px-5 py-4">
            {formError && <p role="alert" className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}
            {loading ? (
              <p className="py-8 text-center text-xs text-gray-400">Loading product…</p>
            ) : (
              <>
                <Field label="Product name" required error={errors.name}>
                  <input value={form.name} onChange={(e) => set("name", e.target.value)} disabled={submitting} aria-invalid={Boolean(errors.name?.length)} className={cn(inputCls, errors.name?.length && invalidCls)} />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Brand">
                    <input value={form.brand} onChange={(e) => set("brand", e.target.value)} disabled={submitting} className={inputCls} />
                  </Field>
                  <Field label="Reorder level">
                    <input type="number" min={0} step="1" value={form.reorderLevel} onChange={(e) => set("reorderLevel", e.target.value)} disabled={submitting} className={inputCls} />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Category">
                    <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} disabled={submitting} className={inputCls}>
                      <option value="">None</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Supplier">
                    <select value={form.supplierId} onChange={(e) => set("supplierId", e.target.value)} disabled={submitting} className={inputCls}>
                      <option value="">None</option>
                      {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Purchase price">
                    <input type="number" min={0} step="any" value={form.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} disabled={submitting} className={inputCls} />
                  </Field>
                  <Field label="Selling price">
                    <input type="number" min={0} step="any" value={form.sellingPrice} onChange={(e) => set("sellingPrice", e.target.value)} disabled={submitting} className={inputCls} />
                  </Field>
                </div>

                <Field label="Description">
                  <input value={form.description} onChange={(e) => set("description", e.target.value)} disabled={submitting} placeholder="Optional" className={inputCls} />
                </Field>

                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input type="checkbox" checked={form.isRetail} onChange={(e) => set("isRetail", e.target.checked)} disabled={submitting} className="size-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900/20" />
                    Retail product
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} disabled={submitting} className="size-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900/20" />
                    Active
                  </label>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
            <button type="button" onClick={onClose} disabled={busy} className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy} className="inline-flex h-9 items-center rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Saving…" : "Save changes"}</button>
          </div>
        </form>
      )}
    </dialog>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string[]; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className={labelCls}>{label}{required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}</label>
      {children}
      {error?.map((m) => <p key={m} role="alert" className="text-[11px] text-red-600">{m}</p>)}
    </div>
  );
}
