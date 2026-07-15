"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Leaves — Apply Leave modal
//
// A native <dialog>, not a modal library. showModal() gives us the focus trap,
// the top layer, Escape-to-close and an inert background for free — a hand-rolled
// or third-party modal would re-implement what the platform already does, and no
// dialog primitive is installed in this project anyway.
//
// FIELDS ARE EXACTLY WHAT POST /api/v1/worker/leaves ACCEPTS: leaveTypeId,
// startDate, endDate, reason. Nothing else is sent. `days` is NOT sent — the route
// computes it; the read-only preview here only mirrors that maths so the worker
// sees the count before submitting.
//
// VALIDATION IS TWO LAYERS. The checks here are a courtesy that saves a round trip;
// the route re-validates and its 422 field errors render verbatim below the
// inputs. Where they overlap the server wins.
// ============================================================================

import * as React from "react";
import { X } from "lucide-react";
import {
  inclusiveDays,
  type ApiEnvelope,
  type LeaveRow,
  type LeaveTypeOption,
} from "./types";

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 " +
  "outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 " +
  "disabled:cursor-not-allowed disabled:bg-gray-50";

const invalidCls = "border-red-300 focus:border-red-400 focus:ring-red-500/10";

// Our form field names are identical to the API's field names, so a 422's
// `errors` object keys map straight onto the inputs below with no translation.
type Errors = Record<string, string[]>;

export function ApplyLeaveModal({
  open,
  onClose,
  onCreated,
  leaveTypes,
  today,
}: {
  open: boolean;
  onClose: () => void;
  /** Handed the authoritative row the API returns, so the list needs no refetch. */
  onCreated: (leave: LeaveRow) => void;
  leaveTypes: LeaveTypeOption[];
  /** Server-computed YYYY-MM-DD — drives the date inputs' `min`. Passed as a prop
   *  rather than read from new Date() in the browser to avoid a hydration mismatch
   *  across midnight. */
  today: string;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  const [leaveTypeId, setLeaveTypeId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [reason, setReason] = React.useState("");

  const [errors, setErrors] = React.useState<Errors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const days = inclusiveDays(startDate, endDate);

  // Reset the form to a clean slate the moment the modal transitions to open. This
  // is a render-phase reset keyed off the previous `open` — the pattern React
  // recommends over a state-resetting effect (which the project's lint rule, quite
  // rightly, forbids for the cascading renders it causes).
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setLeaveTypeId("");
    setStartDate("");
    setEndDate("");
    setReason("");
    setErrors({});
    setFormError(null);
    setSubmitting(false);
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  // Drive the native dialog open/closed from the `open` prop. This is pure DOM
  // synchronisation — no setState — so it belongs in an effect. showModal()/close()
  // throw if called in the wrong state, hence the el.open guards.
  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  function validate(): Errors {
    const next: Errors = {};
    if (!leaveTypeId) next.leaveTypeId = ["Leave type is required"];
    if (!startDate) next.startDate = ["From date is required"];
    if (!endDate) next.endDate = ["To date is required"];
    if (startDate && endDate && endDate < startDate) {
      next.endDate = ["To date cannot be before from date"];
    }
    if (!reason.trim()) next.reason = ["Reason is required"];
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const clientErrors = validate();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      setFormError(null);
      return;
    }

    setErrors({});
    setFormError(null);
    setSubmitting(true);

    let payload: ApiEnvelope<LeaveRow>;
    try {
      const res = await fetch("/api/v1/worker/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Same-origin: the renzo_token cookie rides along and the route applies
        // real RBAC. We never send a branchId or a workerId — the route derives
        // the worker from the session.
        body: JSON.stringify({
          leaveTypeId,
          startDate,
          endDate,
          reason: reason.trim(),
        }),
      });
      payload = (await res.json()) as ApiEnvelope<LeaveRow>;

      if (!res.ok || !payload.success || !payload.data) {
        // Render the route's own field errors verbatim; fall back to its message.
        setErrors(payload.errors ?? {});
        setFormError(payload.errors ? null : payload.message || "Could not apply for leave");
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

  // Close when the backdrop (the dialog element itself, outside the inner panel)
  // is clicked. Clicks on the panel bubble to the dialog too, so we check target.
  function onDialogClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current && !submitting) onClose();
  }

  const noTypes = leaveTypes.length === 0;

  return (
    <dialog
      ref={dialogRef}
      onClick={onDialogClick}
      onCancel={(e) => {
        // Fires on Escape. Let React own the state; block the native close so our
        // effect performs it and `open` stays the single source of truth.
        e.preventDefault();
        if (!submitting) onClose();
      }}
      aria-labelledby="apply-leave-title"
      className="w-[calc(100vw-2rem)] max-w-md rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id="apply-leave-title" className="text-sm font-semibold text-gray-900">
              Apply for leave
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Your request is submitted for approval.
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

          {noTypes && (
            <p className="rounded border border-yellow-100 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
              No leave types are configured yet. Please contact your administrator.
            </p>
          )}

          {/* Leave type */}
          <div className="space-y-1">
            <label htmlFor="leaveTypeId" className="block text-xs font-medium text-gray-700">
              Leave type<span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
            </label>
            <select
              id="leaveTypeId"
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              disabled={submitting || noTypes}
              aria-invalid={Boolean(errors.leaveTypeId)}
              className={`${inputCls} ${errors.leaveTypeId ? invalidCls : ""}`}
            >
              <option value="">Select a leave type…</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code}){t.isPaid ? "" : " · Unpaid"}
                </option>
              ))}
            </select>
            <FieldError messages={errors.leaveTypeId} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="startDate" className="block text-xs font-medium text-gray-700">
                From<span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="startDate"
                type="date"
                value={startDate}
                min={today}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(errors.startDate)}
                className={`${inputCls} ${errors.startDate ? invalidCls : ""}`}
              />
              <FieldError messages={errors.startDate} />
            </div>

            <div className="space-y-1">
              <label htmlFor="endDate" className="block text-xs font-medium text-gray-700">
                To<span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="endDate"
                type="date"
                value={endDate}
                // Never let the picker offer a to-date before the from-date.
                min={startDate || today}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={submitting}
                aria-invalid={Boolean(errors.endDate)}
                className={`${inputCls} ${errors.endDate ? invalidCls : ""}`}
              />
              <FieldError messages={errors.endDate} />
            </div>
          </div>

          {/* Total days — read-only, computed */}
          <div className="flex items-center justify-between rounded border border-gray-100 bg-gray-50 px-3 py-2">
            <span className="text-xs font-medium text-gray-500">Total days</span>
            <span className="text-sm font-semibold text-gray-900">
              {days > 0 ? `${days} ${days === 1 ? "day" : "days"}` : "—"}
            </span>
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <label htmlFor="reason" className="block text-xs font-medium text-gray-700">
              Reason<span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              rows={3}
              placeholder="Briefly describe the reason for your leave"
              aria-invalid={Boolean(errors.reason)}
              className={`w-full rounded border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:cursor-not-allowed disabled:bg-gray-50 ${
                errors.reason ? invalidCls : ""
              }`}
            />
            <FieldError messages={errors.reason} />
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
            disabled={submitting || noTypes}
            className="inline-flex h-9 items-center rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Submit request"}
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
