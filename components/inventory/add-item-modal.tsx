"use client";

// OWNER: Gauransh
// MODULE: Inventory Management

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import type { ApiEnvelope, Option } from "./types";

// Adding an inventory item is two REUSED operations, not a new endpoint:
//   1. POST /products         → create the (global) product master.
//   2. POST /stock/adjust      → seed the opening quantity into the branch as an
//                                ADJUSTMENT, which writes the StockMovement audit row.
// The stock/adjust route pins a BRANCH_ADMIN to their session branch and lets a
// global role choose one, so branch isolation is enforced by the backend either way —
// this form never decides the branch for a branch admin.

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:bg-gray-50";
const invalidCls = "border-red-300 focus:border-red-400 focus:ring-red-500/10";
const labelCls = "block text-xs font-medium text-gray-700";

type Errors = Record<string, string[]>;

export function AddItemModal({
  open,
  onClose,
  onDone,
  categories,
  suppliers,
  branches,
  isSuperAdmin,
  fixedBranchId,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
  categories: Option[];
  suppliers: Option[];
  /** Non-empty only for a Super Admin — drives the branch selector's visibility. */
  branches: Option[];
  isSuperAdmin: boolean;
  /** Inventory Manager: a GLOBAL-scoped role, so the branch the backend cannot pin
   *  is supplied here explicitly (their own branch). When set, no branch selector is
   *  shown and every write targets this branch. */
  fixedBranchId?: string;
}) {
  const router = useRouter();
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  const [form, setForm] = React.useState({
    name: "", sku: "", categoryId: "", supplierId: "", branchId: "",
    purchasePrice: "", sellingPrice: "", quantity: "", unit: "ml",
    reorderLevel: "10", description: "", notes: "", isRetail: false, expiryTracked: false,
  });
  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    // Clear only the touched field's error — other fields keep their messages AND values.
    setErrors((e) => (e[key as string] ? { ...e, [key as string]: [] } : e));
  };

  // Render-phase reset keyed on the open transition (the project's lint rule prefers
  // this over a state-setting effect).
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setForm({
      name: "", sku: "", categoryId: "", supplierId: "", branchId: "",
      purchasePrice: "", sellingPrice: "", quantity: "", unit: "ml",
      reorderLevel: "10", description: "", notes: "", isRetail: false, expiryTracked: false,
    });
    setErrors({});
    setFormError(null);
    setSubmitting(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Client-side validation mirrors the backend's required fields so a user sees the
  // problem instantly; the API still validates authoritatively.
  function validate(): Errors {
    const e: Errors = {};
    if (!form.name.trim()) e.name = ["Product name is required"];
    if (!form.sku.trim()) e.sku = ["SKU is required"];
    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty <= 0) e.quantity = ["Enter an opening quantity greater than zero"];
    if (isSuperAdmin && !fixedBranchId && !form.branchId) e.branchId = ["Select a branch"];
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (submitting) return;

    const v = validate();
    if (Object.keys(v).length) {
      setErrors(v);
      return;
    }
    setErrors({});
    setFormError(null);
    setSubmitting(true);

    try {
      // STEP 1 — create the product master (reused endpoint).
      const prodRes = await fetch(API.admin.products, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          sku: form.sku.trim(),
          categoryId: form.categoryId || undefined,
          supplierId: form.supplierId || undefined,
          description: form.description.trim() || undefined,
          unit: form.unit.trim() || "ml",
          purchasePrice: Number(form.purchasePrice) || 0,
          sellingPrice: Number(form.sellingPrice) || 0,
          reorderLevel: Number(form.reorderLevel) || 0,
          isRetail: form.isRetail,
          expiryTracked: form.expiryTracked,
        }),
      });
      const prodJson = (await prodRes.json()) as ApiEnvelope<{ id: string }>;
      if (!prodRes.ok || !prodJson.success || !prodJson.data) {
        // 409 (duplicate SKU) has no field map — surface it against the SKU input.
        if (prodRes.status === 409) setErrors({ sku: [prodJson.message || "SKU already exists"] });
        else if (prodJson.errors) setErrors(prodJson.errors);
        else setFormError(prodJson.message || "Could not create product");
        return;
      }

      // STEP 2 — seed the opening stock into the branch (reused endpoint). branchId is
      // sent only for a global role; the API ignores it for a branch admin.
      const stockRes = await fetch(API.admin.stockAdjust, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: prodJson.data.id,
          branchId: fixedBranchId ?? (isSuperAdmin ? form.branchId : undefined),
          type: "ADJUSTMENT",
          delta: Number(form.quantity),
          notes: form.notes.trim() || "Opening stock",
        }),
      });
      const stockJson = (await stockRes.json()) as ApiEnvelope<unknown>;
      if (!stockRes.ok || !stockJson.success) {
        // The product exists but seeding failed — say so plainly rather than pretend.
        setFormError(stockJson.message || "Product was created, but the opening stock could not be added. Adjust it from the row menu.");
        router.refresh();
        return;
      }
    } catch {
      setFormError("Could not reach the server. Please try again.");
      return;
    } finally {
      setSubmitting(false);
    }

    router.refresh();
    onDone("Item added");
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); if (!submitting) onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current && !submitting) onClose(); }}
      aria-labelledby="add-item-title"
      className="w-[calc(100vw-2rem)] max-w-lg rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      {open && (
        <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 id="add-item-title" className="text-sm font-semibold text-gray-900">Add item</h2>
              <p className="mt-0.5 text-xs text-gray-500">Create a product and seed its opening stock.</p>
            </div>
            <button type="button" onClick={onClose} disabled={submitting} aria-label="Close" className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50">
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-4 overflow-y-auto px-5 py-4">
            {formError && <p role="alert" className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Product name" required error={errors.name}>
                <input value={form.name} onChange={(e) => set("name", e.target.value)} disabled={submitting} aria-invalid={Boolean(errors.name?.length)} className={cn(inputCls, errors.name?.length && invalidCls)} />
              </Field>
              <Field label="SKU" required error={errors.sku}>
                <input value={form.sku} onChange={(e) => set("sku", e.target.value)} disabled={submitting} aria-invalid={Boolean(errors.sku?.length)} className={cn(inputCls, "font-mono", errors.sku?.length && invalidCls)} />
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

            {isSuperAdmin && (
              <Field label="Branch" required error={errors.branchId}>
                <select value={form.branchId} onChange={(e) => set("branchId", e.target.value)} disabled={submitting} aria-invalid={Boolean(errors.branchId?.length)} className={cn(inputCls, errors.branchId?.length && invalidCls)}>
                  <option value="">Select a branch…</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </Field>
            )}

            <div className="grid grid-cols-3 gap-3">
              <Field label="Purchase price">
                <input type="number" min={0} step="any" value={form.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} disabled={submitting} className={inputCls} />
              </Field>
              <Field label="Selling price">
                <input type="number" min={0} step="any" value={form.sellingPrice} onChange={(e) => set("sellingPrice", e.target.value)} disabled={submitting} className={inputCls} />
              </Field>
              <Field label="Reorder level">
                <input type="number" min={0} step="1" value={form.reorderLevel} onChange={(e) => set("reorderLevel", e.target.value)} disabled={submitting} className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Opening quantity" required error={errors.quantity}>
                <input type="number" min={0} step="any" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} disabled={submitting} aria-invalid={Boolean(errors.quantity?.length)} className={cn(inputCls, errors.quantity?.length && invalidCls)} />
              </Field>
              <Field label="Unit">
                <input value={form.unit} onChange={(e) => set("unit", e.target.value)} disabled={submitting} placeholder="ml, pcs, g…" className={inputCls} />
              </Field>
            </div>

            <Field label="Description">
              <input value={form.description} onChange={(e) => set("description", e.target.value)} disabled={submitting} placeholder="Optional" className={inputCls} />
            </Field>

            <Field label="Notes">
              <input value={form.notes} onChange={(e) => set("notes", e.target.value)} disabled={submitting} placeholder="Recorded on the opening stock movement" className={inputCls} />
            </Field>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input type="checkbox" checked={form.isRetail} onChange={(e) => set("isRetail", e.target.checked)} disabled={submitting} className="size-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900/20" />
                Retail product (sold to customers)
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input type="checkbox" checked={form.expiryTracked} onChange={(e) => set("expiryTracked", e.target.checked)} disabled={submitting} className="size-3.5 rounded border-gray-300 text-gray-900 focus:ring-gray-900/20" />
                Track expiry
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
            <button type="button" onClick={onClose} disabled={submitting} className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex h-9 items-center rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Adding…" : "Add item"}</button>
          </div>
        </form>
      )}
    </dialog>
  );
}

// Small labelled field wrapper — keeps the form markup readable and error rendering
// consistent (only the invalid field shows a message; values are never cleared).
function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string[]; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className={labelCls}>{label}{required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}</label>
      {children}
      {error?.map((m) => <p key={m} role="alert" className="text-[11px] text-red-600">{m}</p>)}
    </div>
  );
}
