"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Portfolio Change Requests (UI) — submit-for-approval modal
//
// The worker edits a DRAFT of one professional field, pre-filled with the current
// live value, and submits it for approval. Nothing here writes the live portfolio;
// it POSTs a request to /api/v1/worker/portfolio-requests, which the Branch Admin
// reviews. Inline, controlled validation: a rejected field turns red on its own
// and no other entered data is lost, with no page refresh.
//
// Types offered are the ones the backend can actually apply AND the UI can source:
// bio, experience, languages, certificates, gallery. Skill / skill-level are absent
// because there is no worker-facing skill catalogue endpoint to pick a skill from —
// they light up the moment such an endpoint exists, with no change here.
// ============================================================================

import * as React from "react";
import { X } from "lucide-react";
import { ImageUpload } from "@/components/shared/image-upload";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import type { PortfolioRequest, PortfolioRequestType } from "./request-types";
import type { PortfolioSummary } from "./types";

type Envelope<T> = { success: boolean; message: string; data?: T; errors?: Record<string, string[]> };
type Errors = Record<string, string[]>;

const TYPE_OPTIONS: { value: PortfolioRequestType; label: string }[] = [
  { value: "BIO", label: "Professional bio" },
  { value: "EXPERIENCE", label: "Years of experience" },
  { value: "LANGUAGE", label: "Languages" },
  { value: "CERTIFICATE", label: "Certificates" },
  { value: "GALLERY", label: "Portfolio work (gallery)" },
];

const GALLERY_CATEGORIES = [
  { value: "HAIR", label: "Hair" },
  { value: "MAKEUP", label: "Makeup" },
  { value: "NAILS", label: "Nails" },
  { value: "SPA", label: "Spa" },
  { value: "SKIN", label: "Skin" },
  { value: "GROOMING", label: "Grooming" },
  { value: "OTHER", label: "Other" },
];

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none " +
  "transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:bg-gray-50";
const invalidCls = "border-red-300 focus:border-red-400 focus:ring-red-500/10";
const textareaCls =
  "w-full rounded border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none " +
  "transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:bg-gray-50";

function toList(v: string): string[] {
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export function PortfolioRequestModal({
  open,
  summary,
  onClose,
  onCreated,
}: {
  open: boolean;
  summary: PortfolioSummary;
  onClose: () => void;
  onCreated: (request: PortfolioRequest) => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  const [type, setType] = React.useState<PortfolioRequestType>("BIO");
  const [bio, setBio] = React.useState("");
  const [experience, setExperience] = React.useState("0");
  const [languages, setLanguages] = React.useState("");
  const [certificates, setCertificates] = React.useState("");
  const [afterImage, setAfterImage] = React.useState<string | null>(null);
  const [beforeImage, setBeforeImage] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");

  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Seed the draft from the CURRENT live values the moment the modal opens — a
  // render-phase reset (React's recommended alternative to a state-setting effect).
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setType("BIO");
    setBio(summary.bio ?? "");
    setExperience(String(summary.experienceYears ?? 0));
    setLanguages(summary.languages.join(", "));
    setCertificates(summary.certificates.join(", "));
    setAfterImage(null);
    setBeforeImage(null);
    setCategory("");
    setTitle("");
    setDescription("");
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

  /** Clear a single field's error the moment it is edited. */
  function clearError(name: string) {
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function validate(): Errors {
    const e: Errors = {};
    if (type === "BIO" && !bio.trim()) e.bio = ["A bio is required"];
    if (type === "EXPERIENCE") {
      const n = Number(experience);
      if (!Number.isInteger(n) || n < 0) e.experience = ["Enter a whole number of years, 0 or more"];
    }
    if (type === "LANGUAGE" && toList(languages).length === 0) e.languages = ["Add at least one language"];
    if (type === "CERTIFICATE" && toList(certificates).length === 0) e.certificates = ["Add at least one certificate"];
    if (type === "GALLERY") {
      if (!afterImage) e.afterImage = ["An 'after' image is required"];
      if (!category) e.category = ["Choose a category"];
    }
    return e;
  }

  function buildPayload(): Record<string, unknown> {
    switch (type) {
      case "BIO":
        return { bio: bio.trim() };
      case "EXPERIENCE":
        return { experience: Number(experience) };
      case "LANGUAGE":
        return { languages: toList(languages) };
      case "CERTIFICATE":
        return { certificates: toList(certificates) };
      case "GALLERY":
        return {
          category,
          title: title.trim() || null,
          description: description.trim() || null,
          beforeImage: beforeImage ?? null,
          afterImage,
        };
      default:
        return {};
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const clientErrors = validate();
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors);
      setFormError(null);
      return;
    }
    setErrors({});
    setFormError(null);
    setSubmitting(true);

    let payload: Envelope<PortfolioRequest>;
    try {
      const res = await fetch(API.worker.portfolioRequests, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload: buildPayload() }),
      });
      payload = (await res.json()) as Envelope<PortfolioRequest>;
      if (!res.ok || !payload.success || !payload.data) {
        setErrors(payload.errors ?? {});
        setFormError(payload.errors ? null : payload.message || "Could not submit your request");
        return;
      }
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.");
      return;
    } finally {
      setSubmitting(false);
    }

    onCreated(payload.data);
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        if (!submitting) onClose();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current && !submitting) onClose();
      }}
      aria-labelledby="pr-modal-title"
      className="w-[calc(100vw-2rem)] max-w-lg rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id="pr-modal-title" className="text-sm font-semibold text-gray-900">
              Request a portfolio update
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Your Branch Admin reviews this before it goes live.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {formError && (
            <p role="alert" className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              {formError}
            </p>
          )}

          <div className="space-y-1">
            <label htmlFor="pr-type" className="block text-xs font-medium text-gray-700">
              What would you like to update?
            </label>
            <select
              id="pr-type"
              value={type}
              onChange={(e) => {
                setType(e.target.value as PortfolioRequestType);
                setErrors({});
                setFormError(null);
              }}
              disabled={submitting}
              className={inputCls}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* BIO */}
          {type === "BIO" && (
            <Field label="Professional bio" error={errors.bio} required>
              <textarea
                value={bio}
                onChange={(e) => { setBio(e.target.value); clearError("bio"); }}
                disabled={submitting}
                rows={4}
                aria-invalid={Boolean(errors.bio)}
                placeholder="Describe your professional experience and style"
                className={cn(textareaCls, errors.bio && invalidCls)}
              />
            </Field>
          )}

          {/* EXPERIENCE */}
          {type === "EXPERIENCE" && (
            <Field label="Years of experience" error={errors.experience} required className="max-w-40">
              <input
                type="number"
                min={0}
                value={experience}
                onChange={(e) => { setExperience(e.target.value); clearError("experience"); }}
                disabled={submitting}
                aria-invalid={Boolean(errors.experience)}
                className={cn(inputCls, errors.experience && invalidCls)}
              />
            </Field>
          )}

          {/* LANGUAGE */}
          {type === "LANGUAGE" && (
            <Field label="Languages" error={errors.languages} hint="Comma separated — Hindi, English" required>
              <input
                value={languages}
                onChange={(e) => { setLanguages(e.target.value); clearError("languages"); }}
                disabled={submitting}
                aria-invalid={Boolean(errors.languages)}
                className={cn(inputCls, errors.languages && invalidCls)}
              />
            </Field>
          )}

          {/* CERTIFICATE */}
          {type === "CERTIFICATE" && (
            <Field label="Certificates" error={errors.certificates} hint="Comma separated" required>
              <input
                value={certificates}
                onChange={(e) => { setCertificates(e.target.value); clearError("certificates"); }}
                disabled={submitting}
                aria-invalid={Boolean(errors.certificates)}
                className={cn(inputCls, errors.certificates && invalidCls)}
              />
            </Field>
          )}

          {/* GALLERY */}
          {type === "GALLERY" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <ImageUpload value={afterImage} onChange={(v) => { setAfterImage(v); clearError("afterImage"); }} label="After image *" />
                  <FieldError error={errors.afterImage} />
                </div>
                <ImageUpload value={beforeImage} onChange={setBeforeImage} label="Before image (optional)" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Category" error={errors.category} required>
                  <select
                    value={category}
                    onChange={(e) => { setCategory(e.target.value); clearError("category"); }}
                    disabled={submitting}
                    aria-invalid={Boolean(errors.category)}
                    className={cn(inputCls, errors.category && invalidCls)}
                  >
                    <option value="">Select…</option>
                    {GALLERY_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Title">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={submitting}
                    placeholder="e.g. Balayage colour"
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Description">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={submitting}
                  rows={2}
                  className={textareaCls}
                />
              </Field>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-9 items-center rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit for approval"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function Field({
  label,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  error?: string[];
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="block text-xs font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error?.length && <p className="text-[11px] text-gray-400">{hint}</p>}
      <FieldError error={error} />
    </div>
  );
}

function FieldError({ error }: { error?: string[] }) {
  if (!error?.length) return null;
  return (
    <>
      {error.map((m) => (
        <p key={m} role="alert" className="text-[11px] text-red-600">{m}</p>
      ))}
    </>
  );
}
