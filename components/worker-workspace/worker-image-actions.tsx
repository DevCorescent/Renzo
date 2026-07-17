"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { ImageUpload } from "@/components/shared/image-upload";
import { API } from "@/lib/endpoints";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
};

const CATEGORIES = [
  ["HAIR", "Hair"],
  ["MAKEUP", "Makeup"],
  ["NAILS", "Nails"],
  ["SPA", "Spa"],
  ["SKIN", "Skin"],
  ["GROOMING", "Grooming"],
  ["OTHER", "Other"],
] as const;

export function WorkerPhotoButton({
  workerId,
}: {
  workerId: string;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const uploadResponse = await fetch(API.upload, {
        method: "POST",
        body: form,
      });
      const uploaded = (await uploadResponse.json()) as ApiEnvelope<{
        url: string;
      }>;
      if (!uploadResponse.ok || !uploaded.success || !uploaded.data?.url) {
        throw new Error(uploaded.message || "Image upload failed");
      }

      const saveResponse = await fetch(API.admin.worker(workerId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profilePhoto: uploaded.data.url }),
      });
      const saved = (await saveResponse.json()) as ApiEnvelope<unknown>;
      if (!saveResponse.ok || !saved.success) {
        throw new Error(saved.message || "Could not save profile photo");
      }

      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not update profile photo"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute -bottom-2 -right-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="Upload worker profile photo"
        title={error ?? "Upload profile photo"}
        className="flex size-9 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-70"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Camera className="size-4" aria-hidden="true" />
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}

export function AddPortfolioWorkButton({
  workerId,
}: {
  workerId: string;
}) {
  const router = useRouter();
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [open, setOpen] = React.useState(false);
  const [afterImage, setAfterImage] = React.useState<string | null>(null);
  const [beforeImage, setBeforeImage] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState("HAIR");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function resetAndClose() {
    setOpen(false);
    setAfterImage(null);
    setBeforeImage(null);
    setCategory("HAIR");
    setTitle("");
    setDescription("");
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!afterImage || busy) {
      if (!afterImage) setError("Upload an after image");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(API.admin.workerPortfolio(workerId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          afterImage,
          beforeImage,
          category,
          title: title.trim() || null,
          description: description.trim() || null,
        }),
      });
      const payload = (await response.json()) as ApiEnvelope<unknown>;
      if (!response.ok || !payload.success) {
        const fieldError = payload.errors
          ? Object.values(payload.errors).flat()[0]
          : null;
        throw new Error(fieldError || payload.message || "Could not add work");
      }

      resetAndClose();
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not add portfolio work"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
      >
        <ImagePlus className="size-3.5" aria-hidden="true" />
        Upload work
      </button>

      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) resetAndClose();
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current && !busy) resetAndClose();
        }}
        className="w-[calc(100vw-2rem)] max-w-xl rounded-xl border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
      >
        <form onSubmit={submit}>
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Upload portfolio work
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Images upload to R2 and remain pending until approved.
              </p>
            </div>
            <button
              type="button"
              onClick={resetAndClose}
              disabled={busy}
              aria-label="Close"
              className="rounded p-1 text-gray-400 transition hover:bg-gray-100"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-4 px-5 py-4">
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700"
              >
                {error}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <ImageUpload
                value={afterImage}
                onChange={setAfterImage}
                label="After image *"
              />
              <ImageUpload
                value={beforeImage}
                onChange={setBeforeImage}
                label="Before image"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-medium text-gray-700">
                Category
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                >
                  {CATEGORIES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-medium text-gray-700">
                Title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  placeholder="e.g. Bridal hairstyle"
                  className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-2.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                />
              </label>
            </div>

            <label className="block text-xs font-medium text-gray-700">
              Description
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Describe the work"
                className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
            <button
              type="button"
              onClick={resetAndClose}
              disabled={busy}
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {busy && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              {busy ? "Saving…" : "Add work"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
