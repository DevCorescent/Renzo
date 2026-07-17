"use client";

import * as React from "react";
import { X, Plus } from "lucide-react";
import { API } from "@/lib/endpoints";
import type { LeaveTypeOption } from "./types";

type WorkerOpt = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  employeeCode: string;
};

type Envelope<T> = { success: boolean; message: string; data?: T };

export function GrantLeaveModal({
  leaveTypes,
  onGrant,
  onDone,
}: {
  leaveTypes: LeaveTypeOption[];
  onGrant: (input: {
    workerId: string;
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    reason: string;
  }) => Promise<string | null>;
  onDone?: (message: string) => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [open, setOpen] = React.useState(false);
  const [workers, setWorkers] = React.useState<WorkerOpt[]>([]);
  const [workerId, setWorkerId] = React.useState("");
  const [leaveTypeId, setLeaveTypeId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API.admin.workers}?limit=100&isActive=true`);
        const json = (await res.json()) as Envelope<{ items: WorkerOpt[] }>;
        if (!cancelled && res.ok && json.success && json.data) {
          setWorkers(json.data.items);
        }
      } catch {
        /* empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  function reset() {
    setWorkerId("");
    setLeaveTypeId(leaveTypes[0]?.id ?? "");
    setStartDate("");
    setEndDate("");
    setReason("");
    setError(null);
    setSubmitting(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const err = await onGrant({ workerId, leaveTypeId, startDate, endDate, reason });
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    onDone?.("Leave granted");
    setOpen(false);
    reset();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setLeaveTypeId(leaveTypes[0]?.id ?? "");
          setOpen(true);
        }}
        className="inline-flex h-9 items-center gap-1.5 rounded bg-gray-900 px-3 text-sm font-medium text-white transition hover:bg-gray-800"
      >
        <Plus className="size-3.5" aria-hidden />
        Grant leave
      </button>

      <dialog
        ref={dialogRef}
        onCancel={(e) => {
          e.preventDefault();
          if (!submitting) setOpen(false);
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current && !submitting) setOpen(false);
        }}
        className="fixed inset-0 m-auto w-full max-w-md rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
      >
        <form onSubmit={submit} className="flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Grant leave</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="rounded p-1 text-gray-400 hover:bg-gray-100"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-3 px-5 py-4">
            {error && (
              <p role="alert" className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}

            <label className="block text-xs font-medium text-gray-600">
              Worker
              <select
                required
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                className="mt-1 h-9 w-full rounded border border-gray-200 px-2 text-sm"
              >
                <option value="">Select worker…</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.displayName || `${w.firstName} ${w.lastName}`} ({w.employeeCode})
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs font-medium text-gray-600">
              Leave type
              <select
                required
                value={leaveTypeId}
                onChange={(e) => setLeaveTypeId(e.target.value)}
                className="mt-1 h-9 w-full rounded border border-gray-200 px-2 text-sm"
              >
                <option value="">Select type…</option>
                {leaveTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-gray-600">
                From
                <input
                  required
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-gray-200 px-2 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-gray-600">
                To
                <input
                  required
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 h-9 w-full rounded border border-gray-200 px-2 text-sm"
                />
              </label>
            </div>

            <label className="block text-xs font-medium text-gray-600">
              Reason
              <textarea
                required
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-sm"
                placeholder="Why is this leave being granted?"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={submitting}
              className="h-9 rounded border border-gray-200 px-3 text-sm text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-9 rounded bg-gray-900 px-4 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? "Granting…" : "Grant leave"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
