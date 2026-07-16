"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Portfolio (UI) — add / edit a gallery item
//
// One native <dialog>, two modes: `editing` null → create (POST), a row → edit
// (PATCH). Reuses the shared ImageUpload for both images and posts ONLY the fields
// the existing worker portfolio API accepts — afterImage (required), category
// (the real PortfolioCategory enum), title, description, beforeImage. Nothing new
// is sent; the route re-validates and its 422 renders verbatim.
//
// A content edit sends the item back to "pending" server-side (the route already
// clears approval), which the caller reflects — a worker cannot slip an unvetted
// image past review by editing an approved one.
// ============================================================================

import * as React from "react";
import { X } from "lucide-react";
import { ImageUpload } from "@/components/shared/image-upload";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import type { GalleryItem } from "./types";

// The real PortfolioCategory enum — mirrored locally (as the route itself does)
// rather than importing @prisma/client into the client bundle.
const CATEGORIES = [
  { value: "HAIR", label: "Hair" },
  { value: "MAKEUP", label: "Makeup" },
  { value: "NAILS", label: "Nails" },
  { value: "SPA", label: "Spa" },
  { value: "SKIN", label: "Skin" },
  { value: "GROOMING", label: "Grooming" },
  { value: "OTHER", label: "Other" },
] as const;

type Envelope<T> = { success: boolean; message: string; data?: T; errors?: Record<string, string[]> };
type Errors = Record<string, string[]>;

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none " +
  "transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 " +
  "disabled:cursor-not-allowed disabled:bg-gray-50";
const invalidCls = "border-red-300 focus:border-red-400 focus:ring-red-500/10";

export function PortfolioItemModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: GalleryItem | null;
  onClose: () => void;
  onSaved: (item: GalleryItem, mode: "create" | "edit") => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const mode: "create" | "edit" = editing ? "edit" : "create";

  const [afterImage, setAfterImage] = React.useState<string | null>(null);
  const [beforeImage, setBeforeImage] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");

  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // Seed from `editing` the moment the modal opens — a render-phase reset keyed on
  // the previous open state (the pattern React recommends over a state-setting
  // effect, which the project's lint forbids).
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setAfterImage(editing?.afterImage ?? null);
    setBeforeImage(editing?.beforeImage ?? null);
    setCategory(editing?.category ?? "");
    setTitle(editing?.title ?? "");
    setDescription(editing?.description ?? "");
    setErrors({});
    setFormError(null);
    setSubmitting(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  // Pure DOM sync — no setState here.
  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  function validate(): Errors {
    const next: Errors = {};
    if (!afterImage) next.afterImage = ["An 'after' image is required"];
    if (!category) next.category = ["Choose a category"];
    return next;
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

    // Create sends the whole item; edit sends the editable content fields.
    const body = {
      afterImage,
      beforeImage: beforeImage ?? null,
      category,
      title: title.trim() || null,
      description: description.trim() || null,
    };

    let payload: Envelope<GalleryItem>;
    try {
      const res = await fetch(
        mode === "create" ? API.worker.portfolio : API.worker.portfolioItem(editing!.id),
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      payload = (await res.json()) as Envelope<GalleryItem>;

      if (!res.ok || !payload.success || !payload.data) {
        setErrors(payload.errors ?? {});
        setFormError(payload.errors ? null : payload.message || "Could not save this work");
        return;
      }
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.");
      return;
    } finally {
      setSubmitting(false);
    }

    onSaved(payload.data, mode);
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
      aria-labelledby="portfolio-item-title"
      className="w-[calc(100vw-2rem)] max-w-lg rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id="portfolio-item-title" className="text-sm font-semibold text-gray-900">
              {mode === "create" ? "Add portfolio work" : "Edit portfolio work"}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              New and edited work is reviewed by an admin before it appears publicly.
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <ImageUpload value={afterImage} onChange={setAfterImage} label="After image *" />
              <FieldError messages={errors.afterImage} />
            </div>
            <ImageUpload value={beforeImage} onChange={setBeforeImage} label="Before image (optional)" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="pi-category" className="block text-xs font-medium text-gray-700">
                Category<span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
              </label>
              <select
                id="pi-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(errors.category)}
                className={cn(inputCls, errors.category && invalidCls)}
              >
                <option value="">Select…</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <FieldError messages={errors.category} />
            </div>

            <div className="space-y-1">
              <label htmlFor="pi-title" className="block text-xs font-medium text-gray-700">
                Title
              </label>
              <input
                id="pi-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
                placeholder="e.g. Balayage colour"
                className={inputCls}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="pi-description" className="block text-xs font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="pi-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={2}
              placeholder="Briefly describe the work"
              className="w-full rounded border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:bg-gray-50"
            />
          </div>
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
            {submitting ? "Saving…" : mode === "create" ? "Add work" : "Save changes"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <>
      {messages.map((m) => (
        <p key={m} role="alert" className="mt-1 text-[11px] text-red-600">
          {m}
        </p>
      ))}
    </>
  );
}
