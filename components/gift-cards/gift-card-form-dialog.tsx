"use client";

// OWNER: Gauransh
// MODULE: Marketing — Gift Card create/edit dialog
// PURPOSE: Issue / edit a GiftCard via the EXISTING endpoints (POST /admin/gift-cards,
//          PATCH /admin/gift-cards/[id]). Only collects input — validation/creation
//          logic stays in the routes.
//   • Validation: server-side authoritative; a 422 field map flags only the bad input
//     and never clears the form.
//   • Business flow: value + purchaser are set at issue time (the PATCH route can't
//     change them), so they are read-only in edit mode; only presentation/expiry and
//     status are editable afterwards.

import * as React from "react";
import { X } from "lucide-react";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { TYPES, type ApiEnvelope, type GiftCardRow, type GiftCardType } from "./types";

type Mode = "create" | "edit";

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:bg-gray-50 disabled:text-gray-500";
const invalidCls = "border-red-300 focus:border-red-400 focus:ring-red-500/10";

type FormState = {
  type: GiftCardType; value: string; purchasedBy: string; ownedBy: string;
  recipientName: string; recipientPhone: string; giftMessage: string; expiresAt: string;
};

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "" : new Date(ms).toISOString().slice(0, 10);
}
function fromCard(c: GiftCardRow | null): FormState {
  return {
    type: c?.type ?? "DIGITAL",
    value: c ? String(c.value) : "",
    purchasedBy: "",
    ownedBy: "",
    recipientName: c?.recipientName ?? "",
    recipientPhone: c?.recipientPhone ?? "",
    giftMessage: c?.giftMessage ?? "",
    expiresAt: toDateInput(c?.expiresAt ?? null),
  };
}

export function GiftCardFormDialog({
  mode, card, onClose, onSaved,
}: {
  mode: Mode;
  card: GiftCardRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const open = mode === "create" || card !== null;
  const isEdit = mode === "edit";

  const [form, setForm] = React.useState<FormState>(() => fromCard(card));
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  const key = `${mode}:${card?.id ?? "new"}`;
  const [shownKey, setShownKey] = React.useState<string | null>(null);
  if (open && key !== shownKey) { setShownKey(key); setForm(fromCard(card)); setErrors({}); setFormError(null); setSaving(false); }
  else if (!open && shownKey !== null) setShownKey(null);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  function validate(): Partial<Record<keyof FormState, string>> {
    if (isEdit) return {};
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!(Number(form.value) > 0)) e.value = "Enter a value greater than zero";
    if (!form.purchasedBy.trim()) e.purchasedBy = "Purchaser customer id is required";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (saving) return;
    const v = validate();
    if (Object.keys(v).length) { setErrors(v); return; }
    setErrors({}); setFormError(null); setSaving(true);

    // Edit sends only the safe/presentation fields the PATCH route accepts.
    const body = isEdit
      ? {
          recipientName: form.recipientName.trim() || null,
          recipientPhone: form.recipientPhone.trim() || null,
          giftMessage: form.giftMessage.trim() || null,
          expiresAt: form.expiresAt || null,
        }
      : {
          type: form.type,
          value: Number(form.value),
          purchasedBy: form.purchasedBy.trim(),
          ownedBy: form.ownedBy.trim() || undefined,
          recipientName: form.recipientName.trim() || undefined,
          recipientPhone: form.recipientPhone.trim() || undefined,
          giftMessage: form.giftMessage.trim() || undefined,
          expiresAt: form.expiresAt || undefined,
        };

    try {
      const res = await fetch(isEdit ? API.admin.giftCard(card!.id) : API.admin.giftCards, {
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
        } else {
          setFormError(json.message || "Could not save the gift card");
        }
        return;
      }
    } catch {
      setFormError("Could not reach the server. Please try again.");
      return;
    } finally {
      setSaving(false);
    }
    onSaved(isEdit ? "Gift card updated" : "Gift card issued");
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); if (!saving) onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current && !saving) onClose(); }}
      aria-labelledby="gc-form-title"
      className="w-[calc(100vw-2rem)] max-w-md rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      {open && (
        <form onSubmit={handleSubmit} className="flex max-h-[88vh] flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 id="gc-form-title" className="truncate text-sm font-semibold text-gray-900">{isEdit ? `Edit — ${card?.code ?? ""}` : "Issue gift card"}</h2>
            <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50"><X className="size-4" /></button>
          </div>
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            {formError && <p role="alert" className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}

            {!isEdit && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Type"><select value={form.type} onChange={(e) => set("type", e.target.value as GiftCardType)} disabled={saving} className={inputCls}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
                  <Field label="Value" required error={errors.value}><input type="number" min={0} step="any" value={form.value} onChange={(e) => set("value", e.target.value)} disabled={saving} aria-invalid={Boolean(errors.value)} className={cn(inputCls, errors.value && invalidCls)} /></Field>
                </div>
                <Field label="Purchaser customer id" required error={errors.purchasedBy}>
                  <input value={form.purchasedBy} onChange={(e) => set("purchasedBy", e.target.value)} disabled={saving} aria-invalid={Boolean(errors.purchasedBy)} className={cn(inputCls, "font-mono", errors.purchasedBy && invalidCls)} />
                </Field>
                <Field label="Owner customer id" hint="Defaults to the purchaser">
                  <input value={form.ownedBy} onChange={(e) => set("ownedBy", e.target.value)} disabled={saving} className={cn(inputCls, "font-mono")} />
                </Field>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Recipient name"><input value={form.recipientName} onChange={(e) => set("recipientName", e.target.value)} disabled={saving} className={inputCls} /></Field>
              <Field label="Recipient phone"><input value={form.recipientPhone} onChange={(e) => set("recipientPhone", e.target.value)} disabled={saving} className={inputCls} /></Field>
            </div>
            <Field label="Gift message"><input value={form.giftMessage} onChange={(e) => set("giftMessage", e.target.value)} disabled={saving} className={inputCls} /></Field>
            <Field label="Expires on"><input type="date" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} disabled={saving} className={inputCls} /></Field>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
            <button type="button" onClick={onClose} disabled={saving} className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex h-9 items-center rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60">{saving ? "Saving…" : isEdit ? "Save changes" : "Issue gift card"}</button>
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
