"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Leave Types (admin) — create / edit modal
//
// One modal, two modes. `editing` null → create (POST); a row → edit (PATCH). A
// native <dialog> for the focus trap / top layer / Escape, exactly as the worker
// leave modal — no modal dependency is installed.
//
// FIELDS ARE ONLY WHAT THE MODEL STORES: name, code, maxPerYear, isPaid, isActive.
// There is no Description because LeaveType has no such column — the request asked
// for one, but persisting it is impossible without a schema change, and faking it
// (a field that silently drops on save) would be worse than omitting it.
//
// CODE IS IMMUTABLE ONCE SET. It is the stable unique key; on edit it is shown
// read-only. On create it is auto-uppercased as you type so "cl" becomes "CL".
// ============================================================================

import * as React from "react";
import { X } from "lucide-react";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { Toggle } from "./leave-types-ui";
import type { ApiEnvelope, LeaveType } from "./types";

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 " +
  "outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 " +
  "disabled:cursor-not-allowed disabled:bg-gray-50";

const invalidCls = "border-red-300 focus:border-red-400 focus:ring-red-500/10";

type Errors = Record<string, string[]>;

export function LeaveTypeFormModal({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null = create, a row = edit. */
  editing: LeaveType | null;
  onClose: () => void;
  /** Handed the authoritative saved row so the list updates without a refetch. */
  onSaved: (saved: LeaveType, mode: "create" | "edit") => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [maxPerYear, setMaxPerYear] = React.useState("12");
  const [isPaid, setIsPaid] = React.useState(true);
  const [isActive, setIsActive] = React.useState(true);

  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const mode: "create" | "edit" = editing ? "edit" : "create";

  // Seed the form from `editing` the moment the modal opens — a render-phase reset
  // keyed off the previous open state, the pattern React recommends over a
  // state-setting effect (which this project's lint rule forbids).
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setName(editing?.name ?? "");
    setCode(editing?.code ?? "");
    setMaxPerYear(String(editing?.maxPerYear ?? 12));
    setIsPaid(editing?.isPaid ?? true);
    setIsActive(editing?.isActive ?? true);
    setErrors({});
    setFormError(null);
    setSubmitting(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  // Pure DOM sync — no setState, so it belongs in an effect.
  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  function validate(): Errors {
    const next: Errors = {};
    if (!name.trim()) next.name = ["Name is required"];
    if (mode === "create" && !code.trim()) next.code = ["Code is required"];
    if (maxPerYear.trim() && (!Number.isFinite(Number(maxPerYear)) || Number(maxPerYear) < 0)) {
      next.maxPerYear = ["Enter a valid number of days"];
    }
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

    // Create sends everything; edit omits code (immutable) and sends the rest.
    const body =
      mode === "create"
        ? {
            name: name.trim(),
            code: code.trim(),
            maxPerYear: maxPerYear.trim() ? Number(maxPerYear) : undefined,
            isPaid,
            isActive,
          }
        : {
            name: name.trim(),
            maxPerYear: maxPerYear.trim() ? Number(maxPerYear) : undefined,
            isPaid,
            isActive,
          };

    let payload: ApiEnvelope<LeaveType>;
    try {
      const res = await fetch(
        mode === "create" ? API.admin.leaveTypes : API.admin.leaveType(editing!.id),
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      payload = (await res.json()) as ApiEnvelope<LeaveType>;

      if (!res.ok || !payload.success || !payload.data) {
        // Render the route's own field errors verbatim (e.g. 409 duplicate code
        // lands on the code field); fall back to its message otherwise.
        setErrors(payload.errors ?? {});
        setFormError(payload.errors ? null : payload.message || "Could not save the leave type");
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

  function onDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current && !submitting) onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={onDialogClick}
      onCancel={(e) => {
        e.preventDefault();
        if (!submitting) onClose();
      }}
      aria-labelledby="lt-form-title"
      className="w-[calc(100vw-2rem)] max-w-md rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id="lt-form-title" className="text-sm font-semibold text-gray-900">
              {mode === "create" ? "New leave type" : "Edit leave type"}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {mode === "create"
                ? "Workers can request active types when applying for leave."
                : "The code is fixed once created and cannot be changed."}
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

          {/* Name */}
          <div className="space-y-1">
            <label htmlFor="lt-name" className="block text-xs font-medium text-gray-700">
              Name<span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
            </label>
            <input
              id="lt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              maxLength={50}
              placeholder="e.g. Casual Leave"
              aria-invalid={Boolean(errors.name)}
              className={cn(inputCls, errors.name && invalidCls)}
            />
            <FieldError messages={errors.name} />
          </div>

          {/* Code + Max per year */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="lt-code" className="block text-xs font-medium text-gray-700">
                Code<span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="lt-code"
                value={code}
                // Uppercased as typed; whitespace stripped so it stays a clean key.
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                disabled={submitting || mode === "edit"}
                maxLength={10}
                placeholder="e.g. CL"
                aria-invalid={Boolean(errors.code)}
                className={cn(inputCls, "font-mono uppercase", errors.code && invalidCls)}
              />
              <FieldError messages={errors.code} />
              {mode === "edit" && (
                <p className="text-[11px] text-gray-400">Code cannot be changed.</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="lt-max" className="block text-xs font-medium text-gray-700">
                Max days / year
              </label>
              <input
                id="lt-max"
                type="number"
                min={0}
                value={maxPerYear}
                onChange={(e) => setMaxPerYear(e.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(errors.maxPerYear)}
                className={cn(inputCls, errors.maxPerYear && invalidCls)}
              />
              <FieldError messages={errors.maxPerYear} />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3 rounded border border-gray-100 bg-gray-50/60 px-3 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-700">Paid leave</p>
                <p className="text-[11px] text-gray-400">Counts as paid time off.</p>
              </div>
              <Toggle checked={isPaid} onChange={setIsPaid} disabled={submitting} label="Paid leave" />
            </div>
            <div className="flex items-center justify-between border-t border-gray-100 pt-3">
              <div>
                <p className="text-xs font-medium text-gray-700">Active</p>
                <p className="text-[11px] text-gray-400">Only active types appear to workers.</p>
              </div>
              <Toggle checked={isActive} onChange={setIsActive} disabled={submitting} label="Active" />
            </div>
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
            {submitting ? "Saving…" : mode === "create" ? "Create leave type" : "Save changes"}
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
        <p key={m} role="alert" className="text-[11px] text-red-600">
          {m}
        </p>
      ))}
    </>
  );
}
