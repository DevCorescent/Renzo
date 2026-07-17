"use client";

// OWNER: Hemant | MODULE: Worker — Booking day-of-ops actions
// Start / Complete / Reschedule against /api/v1/worker/appointments/[id]/*

import * as React from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

type ApiEnvelope = {
  success: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

const STARTABLE = new Set(["CONFIRMED", "CHECKED_IN"]);
const COMPLETABLE = new Set(["STARTED"]);
const NON_RESCHEDULABLE = new Set(["COMPLETED", "CANCELLED", "NO_SHOW"]);

const inputCls =
  "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 " +
  "outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 " +
  "disabled:cursor-not-allowed disabled:bg-gray-50";

const btnPrimary =
  "inline-flex h-9 items-center rounded bg-gray-900 px-4 text-sm font-medium text-white " +
  "transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const btnSecondary =
  "inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-700 " +
  "transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export function BookingActions({
  appointmentId,
  status,
  hasPendingReschedule = false,
}: {
  appointmentId: string;
  status: string;
  hasPendingReschedule?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"start" | "complete" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);

  const canStart = STARTABLE.has(status);
  const canComplete = COMPLETABLE.has(status);
  const canReschedule = !NON_RESCHEDULABLE.has(status) && !hasPendingReschedule;

  if (!canStart && !canComplete && !canReschedule && !hasPendingReschedule) {
    return null;
  }

  async function postAction(kind: "start" | "complete") {
    if (busy) return;
    setError(null);
    setBusy(kind);
    try {
      const res = await fetch(`/api/v1/worker/appointments/${appointmentId}/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = (await res.json()) as ApiEnvelope;
      if (!res.ok || !body.success) {
        setError(body.message || `Could not ${kind} appointment`);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canStart && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void postAction("start")}
            className={btnPrimary}
          >
            {busy === "start" ? "Starting…" : "Start"}
          </button>
        )}
        {canComplete && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void postAction("complete")}
            className={btnPrimary}
          >
            {busy === "complete" ? "Completing…" : "Complete"}
          </button>
        )}
        {canReschedule && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setRescheduleOpen(true)}
            className={btnSecondary}
          >
            Request reschedule
          </button>
        )}
        {hasPendingReschedule && (
          <span className="text-xs text-gray-500">A reschedule request is pending approval.</span>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      <RescheduleModal
        open={rescheduleOpen}
        appointmentId={appointmentId}
        onClose={() => setRescheduleOpen(false)}
        onSubmitted={() => {
          setRescheduleOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function RescheduleModal({
  open,
  appointmentId,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  appointmentId: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [newDate, setNewDate] = React.useState("");
  const [newTime, setNewTime] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = React.useState(false);

  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [wasOpen, setWasOpen] = React.useState(false);
  if (open && !wasOpen) {
    setWasOpen(true);
    setNewDate("");
    setNewTime("");
    setReason("");
    setFormError(null);
    setFieldErrors({});
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const next: Record<string, string[]> = {};
    if (!newDate) next.newDate = ["Date is required"];
    if (!newTime) next.newTime = ["Time is required"];
    if (!reason.trim()) next.reason = ["Reason is required"];
    if (Object.keys(next).length > 0) {
      setFieldErrors(next);
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/v1/worker/appointments/${appointmentId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newDate,
          // HTML time inputs can include seconds; API expects HH:mm
          newTime: newTime.slice(0, 5),
          reason: reason.trim(),
        }),
      });
      const body = (await res.json()) as ApiEnvelope;
      if (!res.ok || !body.success) {
        setFieldErrors(body.errors ?? {});
        setFormError(body.errors ? null : body.message || "Could not submit reschedule request");
        return;
      }
      onSubmitted();
    } catch {
      setFormError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
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
      aria-labelledby="reschedule-title"
      className="w-[calc(100vw-2rem)] max-w-md rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      <form onSubmit={handleSubmit} className="flex flex-col">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id="reschedule-title" className="text-sm font-semibold text-gray-900">
              Request reschedule
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Propose a new date and time. Approval is required.
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="newDate" className="block text-xs font-medium text-gray-700">
                New date<span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="newDate"
                type="date"
                value={newDate}
                min={today}
                onChange={(e) => setNewDate(e.target.value)}
                disabled={submitting}
                className={`${inputCls} ${fieldErrors.newDate ? "border-red-300" : ""}`}
              />
              {fieldErrors.newDate?.map((m) => (
                <p key={m} role="alert" className="text-[11px] text-red-600">{m}</p>
              ))}
            </div>
            <div className="space-y-1">
              <label htmlFor="newTime" className="block text-xs font-medium text-gray-700">
                New time<span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                id="newTime"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                disabled={submitting}
                className={`${inputCls} ${fieldErrors.newTime ? "border-red-300" : ""}`}
              />
              {fieldErrors.newTime?.map((m) => (
                <p key={m} role="alert" className="text-[11px] text-red-600">{m}</p>
              ))}
            </div>
          </div>

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
              placeholder="Why does this appointment need to move?"
              className={`w-full rounded border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:cursor-not-allowed disabled:bg-gray-50 ${
                fieldErrors.reason ? "border-red-300" : ""
              }`}
            />
            {fieldErrors.reason?.map((m) => (
              <p key={m} role="alert" className="text-[11px] text-red-600">{m}</p>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
          <button type="button" onClick={onClose} disabled={submitting} className={btnSecondary}>
            Cancel
          </button>
          <button type="submit" disabled={submitting} className={btnPrimary}>
            {submitting ? "Submitting…" : "Submit request"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
