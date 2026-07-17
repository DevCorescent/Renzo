"use client";

// OWNER: Gauransh
// MODULE: Membership Management (plan form dialog)
// FLOW  : Create / edit / view a MembershipPlan via the EXISTING endpoints —
//         create → POST /admin/memberships/plans, edit → PATCH /admin/memberships/
//         plans/[id]. Backend validation is authoritative; a 422 flags only the
//         offending field (red border) and never clears the form. On success the
//         parent closes the dialog, toasts and refreshes plans + analytics.
// ACCESS: SUPER_ADMIN, OWNER (enforced by the endpoints).
//
// NOTE  : The PATCH route does not update `tier` or `branchAccess`, so those two are
//         read-only in edit mode — the UI never offers a change the API would ignore.

import * as React from "react";
import { X } from "lucide-react";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { TIERS, type ApiEnvelope, type MembershipTier, type PlanRow } from "./types";

type Mode = "create" | "edit" | "view";

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:bg-gray-50 disabled:text-gray-500";
const invalidCls = "border-red-300 focus:border-red-400 focus:ring-red-500/10";

type FormState = {
  name: string; tier: MembershipTier; price: string; validityDays: string; description: string;
  discountPercent: string; walletCredit: string; branchAccess: string; sortOrder: string;
  priorityBooking: boolean; isActive: boolean;
};

function fromPlan(p: PlanRow | null): FormState {
  return {
    name: p?.name ?? "",
    tier: p?.tier ?? "SILVER",
    price: p ? String(p.price) : "",
    validityDays: p ? String(p.validityDays) : "",
    description: p?.description ?? "",
    discountPercent: p ? String(p.discountPercent) : "0",
    walletCredit: p ? String(p.walletCredit) : "0",
    branchAccess: p?.branchAccess ?? "ALL",
    sortOrder: p ? String(p.sortOrder) : "0",
    priorityBooking: p?.priorityBooking ?? false,
    isActive: p?.isActive ?? true,
  };
}

export function PlanFormDialog({
  mode, plan, onClose, onSaved,
}: {
  mode: Mode;
  plan: PlanRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const open = mode === "create" || plan !== null;

  const [form, setForm] = React.useState<FormState>(() => fromPlan(plan));
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const readOnlyAll = mode === "view";
  // tier + branchAccess can only be set at creation (PATCH ignores them).
  const lockTierBranch = mode === "edit";
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  // Reset the form when a different subject/mode opens the dialog.
  const key = `${mode}:${plan?.id ?? "new"}`;
  const [shownKey, setShownKey] = React.useState<string | null>(null);
  if (open && key !== shownKey) {
    setShownKey(key); setForm(fromPlan(plan)); setErrors({}); setFormError(null); setSaving(false);
  } else if (!open && shownKey !== null) {
    setShownKey(null);
  }

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // UX-only checks; the server re-validates and remains the source of truth.
  function validate(): Partial<Record<keyof FormState, string>> {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) e.name = "Name is required";
    if (!(Number(form.price) >= 0) || form.price === "") e.price = "Enter a valid price";
    if (!(Number(form.validityDays) > 0)) e.validityDays = "Enter a positive number of days";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (saving || readOnlyAll) return;
    const v = validate();
    if (Object.keys(v).length) { setErrors(v); return; }
    setErrors({}); setFormError(null); setSaving(true);

    // Create sends the full payload; edit omits tier/branchAccess (not patchable).
    const base = {
      name: form.name.trim(),
      price: Number(form.price),
      validityDays: Number(form.validityDays),
      description: form.description.trim() || null,
      discountPercent: Number(form.discountPercent) || 0,
      walletCredit: Number(form.walletCredit) || 0,
      priorityBooking: form.priorityBooking,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive,
    };
    const body = mode === "create" ? { ...base, tier: form.tier, branchAccess: form.branchAccess.trim() || "ALL" } : base;

    try {
      const res = await fetch(mode === "create" ? API.admin.membershipPlans : API.admin.membershipPlan(plan!.id), {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !json.success) {
        if (json.errors) {
          const mapped: Partial<Record<keyof FormState, string>> = {};
          for (const [k, msgs] of Object.entries(json.errors)) mapped[k as keyof FormState] = msgs[0];
          setErrors(mapped);
        } else {
          setFormError(json.message || "Could not save the plan");
        }
        return;
      }
    } catch {
      setFormError("Could not reach the server. Please try again.");
      return;
    } finally {
      setSaving(false);
    }
    onSaved(mode === "create" ? "Created Successfully" : "Updated Successfully");
  }

  const title = mode === "create" ? "Add membership plan" : mode === "edit" ? `Edit — ${plan?.name ?? ""}` : plan?.name ?? "Membership plan";

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); if (!saving) onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current && !saving) onClose(); }}
      aria-labelledby="plan-form-title"
      className="w-[calc(100vw-2rem)] max-w-xl rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      {open && (
        <form onSubmit={handleSubmit} className="flex max-h-[88vh] flex-col">
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
            <h2 id="plan-form-title" className="truncate text-sm font-semibold text-gray-900">{title}</h2>
            <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50"><X className="size-4" /></button>
          </div>

          <div className="space-y-4 overflow-y-auto px-5 py-4">
            {formError && <p role="alert" className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Plan name" required error={errors.name}>
                <input value={form.name} onChange={(e) => set("name", e.target.value)} disabled={readOnlyAll} aria-invalid={Boolean(errors.name)} className={cn(inputCls, errors.name && invalidCls)} />
              </Field>
              <Field label="Tier" required error={errors.tier} hint={lockTierBranch ? "Set at creation" : undefined}>
                <select value={form.tier} onChange={(e) => set("tier", e.target.value as MembershipTier)} disabled={readOnlyAll || lockTierBranch} aria-invalid={Boolean(errors.tier)} className={cn(inputCls, errors.tier && invalidCls)}>
                  {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Price" required error={errors.price}>
                <input type="number" min={0} step="any" value={form.price} onChange={(e) => set("price", e.target.value)} disabled={readOnlyAll} aria-invalid={Boolean(errors.price)} className={cn(inputCls, errors.price && invalidCls)} />
              </Field>
              <Field label="Validity (days)" required error={errors.validityDays}>
                <input type="number" min={1} step="1" value={form.validityDays} onChange={(e) => set("validityDays", e.target.value)} disabled={readOnlyAll} aria-invalid={Boolean(errors.validityDays)} className={cn(inputCls, errors.validityDays && invalidCls)} />
              </Field>
              <Field label="Sort order">
                <input type="number" step="1" value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} disabled={readOnlyAll} className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Discount %">
                <input type="number" min={0} step="any" value={form.discountPercent} onChange={(e) => set("discountPercent", e.target.value)} disabled={readOnlyAll} className={inputCls} />
              </Field>
              <Field label="Wallet credit">
                <input type="number" min={0} step="any" value={form.walletCredit} onChange={(e) => set("walletCredit", e.target.value)} disabled={readOnlyAll} className={inputCls} />
              </Field>
              <Field label="Branch access" hint={lockTierBranch ? "Set at creation" : "ALL or a branch id"}>
                <input value={form.branchAccess} onChange={(e) => set("branchAccess", e.target.value)} disabled={readOnlyAll || lockTierBranch} className={inputCls} />
              </Field>
            </div>

            <Field label="Description">
              <textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} disabled={readOnlyAll} className={cn(inputCls, "h-auto py-2")} />
            </Field>

            <div className="flex flex-wrap gap-4 pt-1">
              <Switch label="Priority booking" checked={form.priorityBooking} disabled={readOnlyAll} onChange={(v) => set("priorityBooking", v)} />
              <Switch label="Active" checked={form.isActive} disabled={readOnlyAll} onChange={(v) => set("isActive", v)} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
            <button type="button" onClick={onClose} disabled={saving} className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50">{readOnlyAll ? "Close" : "Cancel"}</button>
            {!readOnlyAll && (
              <button type="submit" disabled={saving} className="inline-flex h-9 items-center rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:cursor-not-allowed disabled:opacity-60">{saving ? "Saving…" : mode === "create" ? "Create plan" : "Save changes"}</button>
            )}
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

function Switch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-700">
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 disabled:opacity-50", checked ? "bg-gray-900" : "bg-gray-200")}>
        <span className={cn("inline-block size-3.5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-3.5" : "translate-x-0.5")} />
      </button>
      {label}
    </label>
  );
}
