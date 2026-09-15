"use client";

// OWNER: Gauransh
// MODULE: Services & Categories Management

// ============================================================================
// The Service create / edit / view dialog. It REUSES the existing endpoints only:
//   • create → POST   /api/v1/admin/services
//   • edit   → PATCH  /api/v1/admin/services/[id]
//   • view   → no write; every field disabled.
// The backend is the single source of truth for validation; this form's checks are
// UX only. Backend duplicate/validation messages are mapped back onto the offending
// field (red border + message) while EVERY other field keeps the user's input — the
// form is never cleared and the page never reloads.
//
// ROLE-AWARE FIELDS: a Branch Admin's PATCH may change only image + description
// (the backend enforces this), so in restricted-edit mode every other field is shown
// read-only for context and only image/description are submitted.
//
// LAYOUT mirrors the Branch Admin "Add New Service" modal (image first, uppercase
// labels, For-toggle, full-width Cancel / Create buttons) so both roles see the same
// form. The native <dialog> needs `m-auto`: Tailwind's preflight zeroes every margin,
// which strips the UA `margin: auto` that centers a modal — without it the dialog
// pins to the top-left corner.
// ============================================================================

import * as React from "react";
import { Loader2, X } from "lucide-react";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { ImageUpload } from "@/components/shared/image-upload";
import {
  GENDERS, type ApiEnvelope, type CategoryRef, type Gender,
  type ServiceCapabilities, type ServiceRow, type SubCategory,
} from "./types";

type Mode = "create" | "edit" | "view";

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:border-indigo-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500";
const invalidCls = "border-red-300 focus:border-red-400";
const labelCls = "mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500";

type FormState = {
  categoryId: string; subCategoryId: string; name: string; description: string;
  image: string | null; basePrice: string; duration: string; bufferTime: string;
  gender: Gender; taxPercent: string; sortOrder: string; isPopular: boolean; isActive: boolean;
};

function fromRow(row: ServiceRow | null): FormState {
  return {
    categoryId: row?.category?.id ?? "",
    subCategoryId: row?.subCategory?.id ?? "",
    name: row?.name ?? "",
    description: row?.description ?? "",
    image: row?.image ?? null,
    basePrice: row ? String(row.basePrice) : "",
    duration: row ? String(row.duration) : "",
    bufferTime: row ? String(row.bufferTime) : "0",
    gender: row?.gender ?? "UNISEX",
    taxPercent: row ? String(row.taxPercent) : "18",
    sortOrder: row ? String(row.sortOrder) : "0",
    isPopular: row?.isPopular ?? false,
    isActive: row?.isActive ?? true,
  };
}

// Backend service errors arrive as a message string (not a field map), so map the
// common ones onto the field that caused them — everything else stays a form error.
function mapErrorToField(message: string): keyof FormState | null {
  const m = message.toLowerCase();
  if (m.includes("name")) return "name";
  if (m.includes("sub category") || m.includes("subcategory")) return "subCategoryId";
  if (m.includes("category")) return "categoryId";
  if (m.includes("base price") || m.includes("price")) return "basePrice";
  if (m.includes("duration")) return "duration";
  if (m.includes("buffer")) return "bufferTime";
  if (m.includes("tax")) return "taxPercent";
  if (m.includes("gender")) return "gender";
  return null;
}

export function ServiceFormDialog({
  mode,
  service,
  capabilities,
  categories,
  onClose,
  onSaved,
}: {
  mode: Mode;
  service: ServiceRow | null;
  capabilities: ServiceCapabilities;
  categories: CategoryRef[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const open = mode === "create" || service !== null;

  const [form, setForm] = React.useState<FormState>(() => fromRow(service));
  const [subCategories, setSubCategories] = React.useState<SubCategory[]>([]);
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Restricted edit = branch admin editing (only image + description). View = nothing.
  const restricted = mode === "edit" && !capabilities.editFull && capabilities.editRestricted;
  const readOnlyAll = mode === "view";
  const canEditField = (field: keyof FormState) => {
    if (readOnlyAll) return false;
    if (restricted) return field === "image" || field === "description";
    return true;
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  // Reset the whole form whenever a different subject/mode opens the dialog.
  const key = `${mode}:${service?.id ?? "new"}`;
  const [shownKey, setShownKey] = React.useState<string | null>(null);
  if (open && key !== shownKey) {
    setShownKey(key);
    setForm(fromRow(service));
    setErrors({});
    setFormError(null);
    setSubmitting(false);
  } else if (!open && shownKey !== null) {
    setShownKey(null);
  }

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Load the sub-category catalog for the chosen category (dropdown data is always
  // live from the backend, never hardcoded). Async IIFE — the project's effect-fetch
  // pattern.
  const categoryId = form.categoryId;
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!open || !categoryId) { if (!cancelled) setSubCategories([]); return; }
      try {
        const res = await fetch(`${API.admin.serviceSubcategories}?categoryId=${encodeURIComponent(categoryId)}`);
        const json = (await res.json()) as ApiEnvelope<SubCategory[]>;
        if (!cancelled && res.ok && json.success && json.data) setSubCategories(json.data);
      } catch {
        if (!cancelled) setSubCategories([]);
      }
    })();
    return () => { cancelled = true; };
  }, [open, categoryId]);

  function validate(): Partial<Record<keyof FormState, string>> {
    if (restricted) return {}; // only image/description; nothing required
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) e.name = "Service name is required";
    if (!form.categoryId) e.categoryId = "Category is required";
    if (!(Number(form.basePrice) >= 0) || form.basePrice === "") e.basePrice = "Valid base price is required";
    if (!(Number(form.duration) > 0)) e.duration = "Valid duration is required";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (submitting || readOnlyAll) return;

    const v = validate();
    if (Object.keys(v).length) { setErrors(v); return; }
    setErrors({});
    setFormError(null);
    setSubmitting(true);

    // Restricted edit sends ONLY the two fields the backend accepts from a branch
    // admin; a full create/edit sends the complete, typed payload.
    const body = restricted
      ? { image: form.image, description: form.description.trim() || null }
      : {
          name: form.name.trim(),
          categoryId: form.categoryId,
          subCategoryId: form.subCategoryId || null,
          description: form.description.trim() || null,
          image: form.image,
          basePrice: Number(form.basePrice),
          duration: Number(form.duration),
          bufferTime: Number(form.bufferTime) || 0,
          gender: form.gender,
          taxPercent: Number(form.taxPercent) || 0,
          sortOrder: Number(form.sortOrder) || 0,
          isPopular: form.isPopular,
          isActive: form.isActive,
        };

    try {
      const res = await fetch(mode === "create" ? API.admin.services : API.admin.service(service!.id), {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !json.success) {
        // Prefer a backend field map; else map the message onto its field. Either way
        // NOTHING the user typed is cleared.
        if (json.errors) {
          const mapped: Partial<Record<keyof FormState, string>> = {};
          for (const [k, msgs] of Object.entries(json.errors)) mapped[k as keyof FormState] = msgs[0];
          setErrors(mapped);
        } else {
          const field = mapErrorToField(json.message || "");
          if (field) setErrors({ [field]: json.message } as Partial<Record<keyof FormState, string>>);
          else setFormError(json.message || "Could not save the service");
        }
        return;
      }
    } catch {
      setFormError("Could not reach the server. Please try again.");
      return;
    } finally {
      setSubmitting(false);
    }

    onSaved(mode === "create" ? "Service created" : "Service updated");
  }

  const title = mode === "create" ? "Add New Service" : mode === "edit" ? "Edit Service" : "Service Details";

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); if (!submitting) onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current && !submitting) onClose(); }}
      aria-labelledby="service-form-title"
      className="m-auto w-[calc(100vw-2rem)] max-w-lg overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      {open && (
        <form onSubmit={handleSubmit} className="flex max-h-[90vh] flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <div className="min-w-0">
              <h2 id="service-form-title" className="font-semibold text-gray-900">{title}</h2>
              {mode !== "create" && service && <p className="truncate text-xs text-gray-400">{service.name}</p>}
              {restricted && <p className="mt-0.5 text-xs text-gray-500">You can update the image and description for this service.</p>}
            </div>
            <button type="button" onClick={onClose} disabled={submitting} aria-label="Close" className="text-gray-400 hover:text-gray-600 disabled:opacity-50">
              <X className="size-5" />
            </button>
          </div>

          <div className="space-y-4 overflow-y-auto p-5">
            {/* Image first — same order as the Branch Admin modal. */}
            <div>
              <span className={labelCls}>Service Image</span>
              {canEditField("image") ? (
                <ImageUpload value={form.image} onChange={(url) => set("image", url)} label="Service Photo" />
              ) : form.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image} alt="" className="h-24 w-24 rounded-lg border border-gray-200 object-cover" />
              ) : (
                <p className="text-xs text-gray-400">No image.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field className="col-span-2" label="Service Name" required error={errors.name}>
                <input value={form.name} onChange={(e) => set("name", e.target.value)} disabled={!canEditField("name")} placeholder="e.g. Deep Hair Spa" aria-invalid={Boolean(errors.name)} className={cn(inputCls, errors.name && invalidCls)} />
              </Field>

              <Field label="Category" required error={errors.categoryId}>
                <select value={form.categoryId} onChange={(e) => { set("categoryId", e.target.value); set("subCategoryId", ""); }} disabled={!canEditField("categoryId")} aria-invalid={Boolean(errors.categoryId)} className={cn(inputCls, errors.categoryId && invalidCls)}>
                  <option value="">— Select category —</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Subcategory" error={errors.subCategoryId}>
                <select value={form.subCategoryId} onChange={(e) => set("subCategoryId", e.target.value)} disabled={!canEditField("subCategoryId") || !form.categoryId} className={inputCls}>
                  <option value="">None</option>
                  {subCategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>

              <Field label="Base Price (₹)" required error={errors.basePrice}>
                <input type="number" min={0} step={10} value={form.basePrice} onChange={(e) => set("basePrice", e.target.value)} disabled={!canEditField("basePrice")} placeholder="999" aria-invalid={Boolean(errors.basePrice)} className={cn(inputCls, errors.basePrice && invalidCls)} />
              </Field>
              <Field label="Duration (min)" required error={errors.duration}>
                <input type="number" min={5} step={5} value={form.duration} onChange={(e) => set("duration", e.target.value)} disabled={!canEditField("duration")} placeholder="60" aria-invalid={Boolean(errors.duration)} className={cn(inputCls, errors.duration && invalidCls)} />
              </Field>

              <div className="col-span-2 grid grid-cols-3 gap-3">
                <Field label="Buffer (min)" error={errors.bufferTime}>
                  <input type="number" min={0} step={5} value={form.bufferTime} onChange={(e) => set("bufferTime", e.target.value)} disabled={!canEditField("bufferTime")} className={inputCls} />
                </Field>
                <Field label="Tax %" error={errors.taxPercent}>
                  <input type="number" min={0} step="any" value={form.taxPercent} onChange={(e) => set("taxPercent", e.target.value)} disabled={!canEditField("taxPercent")} className={inputCls} />
                </Field>
                <Field label="Sort order">
                  <input type="number" step={1} value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} disabled={!canEditField("sortOrder")} className={inputCls} />
                </Field>
              </div>

              <Field className="col-span-2" label="For" error={errors.gender}>
                <div className="flex gap-2">
                  {GENDERS.map((g) => (
                    <button
                      key={g.value}
                      type="button"
                      onClick={() => set("gender", g.value)}
                      disabled={!canEditField("gender")}
                      aria-pressed={form.gender === g.value}
                      className={cn(
                        "flex-1 rounded-lg border py-2 text-xs font-medium transition disabled:cursor-not-allowed",
                        form.gender === g.value
                          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50 disabled:hover:bg-transparent",
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field className="col-span-2" label="Description">
                <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} disabled={!canEditField("description")} placeholder="What does this service include?" className={cn(inputCls, "resize-none")} />
              </Field>

              {!restricted && (
                <div className="col-span-2 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                    <input type="checkbox" checked={form.isPopular} onChange={(e) => set("isPopular", e.target.checked)} disabled={!canEditField("isPopular")} className="size-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500/20" />
                    Popular
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
                    <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} disabled={!canEditField("isActive")} className="size-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500/20" />
                    Active
                  </label>
                </div>
              )}
            </div>

            {formError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{formError}</p>}

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose} disabled={submitting} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                {readOnlyAll ? "Close" : "Cancel"}
              </button>
              {!readOnlyAll && (
                <button type="submit" disabled={submitting} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  {mode === "create" ? "Create Service" : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </form>
      )}
    </dialog>
  );
}

function Field({ label, required, error, className, children }: { label: string; required?: boolean; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className={labelCls}>{label}{required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}</label>
      {children}
      {error && <p role="alert" className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
