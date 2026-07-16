"use client";

// OWNER: Gauransh
// MODULE: Marketing — Campaign create dialog
// PURPOSE: Create a Campaign via the EXISTING endpoint POST /admin/campaigns. No
//          campaign create UI existed, so this dialog only COLLECTS input and posts
//          it — all validation/business logic stays in the route (not duplicated).
//   • Backend interaction: POST /api/v1/admin/campaigns.
//   • Validation: server-side is authoritative; a 422 field map flags only the bad
//     input and never clears the form.
//   • Business flow: on success the parent toasts + refreshes the marketing tables.
//   • Error handling: transport failures show a form-level message; inputs kept.

import * as React from "react";
import { X } from "lucide-react";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";

type ApiEnvelope = { success: boolean; message: string; errors?: Record<string, string[]> };

// Mirrors the CampaignChannel enum the route validates against.
const CHANNELS = ["WHATSAPP", "SMS", "EMAIL", "PUSH"] as const;
type Channel = (typeof CHANNELS)[number];

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:bg-gray-50";
const invalidCls = "border-red-300 focus:border-red-400 focus:ring-red-500/10";

type FormState = { name: string; description: string; channel: Channel; scheduledAt: string };
const BLANK: FormState = { name: "", description: "", channel: "WHATSAPP", scheduledAt: "" };

export function CampaignFormDialog({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [form, setForm] = React.useState<FormState>(BLANK);
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => (e[k] ? { ...e, [k]: undefined } : e));
  };

  // Reset when the dialog opens.
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open && !wasOpen) { setWasOpen(true); setForm(BLANK); setErrors({}); setFormError(null); setSaving(false); }
  else if (!open && wasOpen) setWasOpen(false);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (saving) return;
    if (!form.name.trim()) { setErrors({ name: "Campaign name is required" }); return; }
    setErrors({}); setFormError(null); setSaving(true);
    try {
      const res = await fetch(API.admin.campaigns, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          channel: form.channel,
          scheduledAt: form.scheduledAt || null,
        }),
      });
      const json = (await res.json()) as ApiEnvelope;
      if (!res.ok || !json.success) {
        if (json.errors) {
          const mapped: Partial<Record<keyof FormState, string>> = {};
          for (const [k, msgs] of Object.entries(json.errors)) mapped[k as keyof FormState] = msgs[0];
          setErrors(mapped);
        } else {
          setFormError(json.message || "Could not create the campaign");
        }
        return;
      }
    } catch {
      setFormError("Could not reach the server. Please try again.");
      return;
    } finally {
      setSaving(false);
    }
    onCreated("Campaign created");
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); if (!saving) onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current && !saving) onClose(); }}
      aria-labelledby="campaign-form-title"
      className="w-[calc(100vw-2rem)] max-w-md rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      {open && (
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 id="campaign-form-title" className="text-sm font-semibold text-gray-900">Add campaign</h2>
            <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50"><X className="size-4" /></button>
          </div>
          <div className="space-y-4 px-5 py-4">
            {formError && <p role="alert" className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>}
            <Field label="Name" required error={errors.name}>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} disabled={saving} aria-invalid={Boolean(errors.name)} className={cn(inputCls, errors.name && invalidCls)} />
            </Field>
            <Field label="Channel" required error={errors.channel}>
              <select value={form.channel} onChange={(e) => set("channel", e.target.value as Channel)} disabled={saving} aria-invalid={Boolean(errors.channel)} className={cn(inputCls, errors.channel && invalidCls)}>
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Description">
              <textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} disabled={saving} className={cn(inputCls, "h-auto py-2")} />
            </Field>
            <Field label="Schedule for" hint="Leave empty to save as draft">
              <input type="datetime-local" value={form.scheduledAt} onChange={(e) => set("scheduledAt", e.target.value)} disabled={saving} className={inputCls} />
            </Field>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
            <button type="button" onClick={onClose} disabled={saving} className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex h-9 items-center rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-60">{saving ? "Saving…" : "Create campaign"}</button>
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
