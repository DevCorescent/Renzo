"use client";

// OWNER: Gauransh
// MODULE: Coupon Management (form dialog)
// PURPOSE: Create / edit a Coupon via the EXISTING endpoints — create → POST
//          /admin/coupons, edit → PATCH /admin/coupons/[id].
//   • Backend interaction: reuses the coupon routes; no logic duplicated here.
//   • Validation: server-side is authoritative; a 422 (field map) or 409 (duplicate
//     code) flags only the offending field and NEVER clears the form.
//   • Business flow: on success the parent closes, toasts and refreshes table +
//     analytics — no page reload.
//   • Error handling: transport failures surface a form-level message; inputs kept.
//
// The PATCH route only accepts description / value / minOrderAmount / maxDiscount /
// usageLimit / validUntil / isActive, so code / type / applicableTo / refId /
// usageLimitPerCustomer / validFrom are read-only in edit mode (the UI never offers
// a change the API would ignore).

import * as React from "react";
import { X } from "lucide-react";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { TYPES, APPLICABLE, type ApiEnvelope, type ApplicableTo, type CouponRow, type CouponType } from "./types";

type Mode = "create" | "edit";

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:bg-gray-50 disabled:text-gray-500";
const invalidCls = "border-red-300 focus:border-red-400 focus:ring-red-500/10";

type FormState = {
  code: string; description: string; type: CouponType; value: string; minOrderAmount: string;
  maxDiscount: string; applicableTo: ApplicableTo; refId: string; usageLimit: string;
  usageLimitPerCustomer: string; validFrom: string; validUntil: string; isActive: boolean;
};

// ISO datetime → yyyy-mm-dd for a <input type="date"> (UTC-pinned).
function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

function fromCoupon(c: CouponRow | null): FormState {
  return {
    code: c?.code ?? "",
    description: c?.description ?? "",
    type: c?.type ?? "FLAT",
    value: c ? String(c.value) : "",
    minOrderAmount: c ? String(c.minOrderAmount) : "0",
    maxDiscount: c?.maxDiscount != null ? String(c.maxDiscount) : "",
    applicableTo: c?.applicableTo ?? "ALL",
    refId: c?.refId ?? "",
    usageLimit: c?.usageLimit != null ? String(c.usageLimit) : "",
    usageLimitPerCustomer: c ? String(c.usageLimitPerCustomer) : "1",
    validFrom: toDateInput(c?.validFrom ?? null),
    validUntil: toDateInput(c?.validUntil ?? null),
    isActive: c?.isActive ?? true,
  };
}

export function CouponFormDialog({
  mode, coupon, onClose, onSaved,
}: {
  mode: Mode;
  coupon: CouponRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const open = mode === "create" || coupon !== null;
  const isEdit = mode === "edit";

  const [form, setForm] = React.useState<FormState>(() => fromCoupon(coupon));
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  // Reset the form when a different subject/mode opens the dialog.
  const key = `${mode}:${coupon?.id ?? "new"}`;
  const [shownKey, setShownKey] = React.useState<string | null>(null);
  if (open && key !== shownKey) {
    setShownKey(key); setForm(fromCoupon(coupon)); setErrors({}); setFormError(null); setSaving(false);
  } else if (!open && shownKey !== null) {
    setShownKey(null);
  }

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // UX-only checks; the server re-validates authoritatively.
  function validate(): Partial<Record<keyof FormState, string>> {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!isEdit && !form.code.trim()) e.code = "Code is required";
    if (!(Number(form.value) > 0)) e.value = "Enter a value greater than zero";
    if (!isEdit && !form.validFrom) e.validFrom = "Valid-from date is required";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (saving) return;
    const v = validate();
    if (Object.keys(v).length) { setErrors(v); return; }
    setErrors({}); setFormError(null); setSaving(true);

    // Only fields the endpoint accepts are sent (edit is a partial PATCH).
    const numOrNull = (s: string) => (s.trim() === "" ? null : Number(s));
    const body: Record<string, unknown> = isEdit
      ? {
          description: form.description.trim() || null,
          value: Number(form.value),
          minOrderAmount: Number(form.minOrderAmount) || 0,
          maxDiscount: numOrNull(form.maxDiscount),
          usageLimit: numOrNull(form.usageLimit),
          validUntil: form.validUntil || null,
          isActive: form.isActive,
        }
      : {
          code: form.code.trim(),
          description: form.description.trim() || null,
          type: form.type,
          value: Number(form.value),
          minOrderAmount: Number(form.minOrderAmount) || 0,
          maxDiscount: numOrNull(form.maxDiscount),
          applicableTo: form.applicableTo,
          refId: form.refId.trim() || null,
          usageLimit: numOrNull(form.usageLimit),
          usageLimitPerCustomer: Number(form.usageLimitPerCustomer) || 1,
          validFrom: form.validFrom,
          validUntil: form.validUntil || null,
          isActive: form.isActive,
        };

    try {
      const res = await fetch(isEdit ? API.admin.coupon(coupon!.id) : API.admin.coupons, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !json.success) {
        if (json.errors) {
          const mapped: Partial<Record<keyof FormState, string>> = {};
          for (const [k, msgs] of Object.entries(json.errors)) mapped[k as keyof FormState] = msgs[0];
          setErrors(mapped);
        } else if (res.status === 409) {
          // Duplicate code — pin it to the code field, input preserved.
          setErrors({ code: json.message || "Coupon code already exists" });
        } else {
          setFormError(json.message || "Could not save the coupon");
        }
        return;
      }
    } catch {
      setFormError("Could not reach the server. Please try again.");
      return;
    } finally {
      setSaving(false);
    }
    onSaved(isEdit ? "Coupon updated" : "Coupon created");
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); if (!saving) onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current && !saving) onClose(); }}
      aria-labelledby="coupon-form-title"
      className="w-[calc(100vw-2rem)] max-w-xl rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      {open && (
        <form onSubmit={handleSubmit} className="flex max-h-[88vh] flex-col">
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
            <h2 id="coupon-form-title" className="truncate text-sm font-semibold text-gray-900">{isEdit ? `Edit — ${coupon?.code ?? ""}` : "Add coupon"}</h2>
            <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50"><X className="size-4" /></button>
          </div>

          <div className="space-y-4 overflow-y-auto px-5 py-4">
            {formError && <p role="alert" className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Coupon code" required error={errors.code} hint={isEdit ? "Cannot be changed" : undefined}>
                <input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} disabled={isEdit} aria-invalid={Boolean(errors.code)} className={cn(inputCls, "font-mono", errors.code && invalidCls)} />
              </Field>
              <Field label="Type" hint={isEdit ? "Set at creation" : undefined}>
                <select value={form.type} onChange={(e) => set("type", e.target.value as CouponType)} disabled={isEdit} className={inputCls}>
                  {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Description">
              <input value={form.description} onChange={(e) => set("description", e.target.value)} className={inputCls} />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Value" required error={errors.value}>
                <input type="number" min={0} step="any" value={form.value} onChange={(e) => set("value", e.target.value)} aria-invalid={Boolean(errors.value)} className={cn(inputCls, errors.value && invalidCls)} />
              </Field>
              <Field label="Min order">
                <input type="number" min={0} step="any" value={form.minOrderAmount} onChange={(e) => set("minOrderAmount", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Max discount">
                <input type="number" min={0} step="any" value={form.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} placeholder="None" className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Applicable to" hint={isEdit ? "Set at creation" : undefined}>
                <select value={form.applicableTo} onChange={(e) => set("applicableTo", e.target.value as ApplicableTo)} disabled={isEdit} className={inputCls}>
                  {APPLICABLE.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </Field>
              <Field label="Reference id" hint={isEdit ? "Set at creation" : "Service / category / branch id"}>
                <input value={form.refId} onChange={(e) => set("refId", e.target.value)} disabled={isEdit} className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Usage limit (total)">
                <input type="number" min={0} step="1" value={form.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} placeholder="Unlimited" className={inputCls} />
              </Field>
              <Field label="Usage limit / customer" hint={isEdit ? "Set at creation" : undefined}>
                <input type="number" min={1} step="1" value={form.usageLimitPerCustomer} onChange={(e) => set("usageLimitPerCustomer", e.target.value)} disabled={isEdit} className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Valid from" required={!isEdit} error={errors.validFrom} hint={isEdit ? "Set at creation" : undefined}>
                <input type="date" value={form.validFrom} onChange={(e) => set("validFrom", e.target.value)} disabled={isEdit} aria-invalid={Boolean(errors.validFrom)} className={cn(inputCls, errors.validFrom && invalidCls)} />
              </Field>
              <Field label="Valid until">
                <input type="date" value={form.validUntil} onChange={(e) => set("validUntil", e.target.value)} className={inputCls} />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-700">
              <button type="button" role="switch" aria-checked={form.isActive} aria-label="Active" onClick={() => set("isActive", !form.isActive)} className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20", form.isActive ? "bg-gray-900" : "bg-gray-200")}>
                <span className={cn("inline-block size-3.5 rounded-full bg-white shadow transition-transform", form.isActive ? "translate-x-3.5" : "translate-x-0.5")} />
              </button>
              Active
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
            <button type="button" onClick={onClose} disabled={saving} className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex h-9 items-center rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving…" : isEdit ? "Save changes" : "Create coupon"}</button>
          </div>
        </form>
      )}
    </dialog>
  );
}

function Field({ label, required, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-700">{label}{required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}{hint && <span className="ml-1 font-normal text-gray-400">· {hint}</span>}</label>
      {children}
      {error && <p role="alert" className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
