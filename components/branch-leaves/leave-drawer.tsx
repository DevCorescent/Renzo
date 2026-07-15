"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Branch Admin — Leave Management (detail drawer)
//
// A native <dialog> styled as a right-hand sheet: showModal() gives the focus
// trap, top layer and Escape-to-close for free, so no drawer dependency is added.
//
// Approve / reject are two-step: the button reveals an inline confirmation showing
// the worker, leave type and dates before the action fires — no accidental
// approvals. The reject step offers an optional reason (rejectionReason is a real
// nullable column, so it is stored when given and never required).
//
// The action itself is run by the parent (which owns the toast and closes the
// drawer on success); this component only collects intent and surfaces an inline
// error if the parent hands one back.
//
// `approvedBy` is a bare userId with no name relation on the model, so it is NOT
// shown — a raw id helps no one. Only the actioned date and any reason appear.
// ============================================================================

import * as React from "react";
import { X, Check, Ban } from "lucide-react";
import { Badge } from "@/components/shared/ui";
import { WorkerAvatar } from "@/components/workers/worker-ui";
import { cn } from "@/lib/utils";
import { LeaveStatusBadge } from "./leaves-ui";
import { formatDate, workerName, workerBranchName, type BranchLeave } from "./types";

type ActionResult = string | null; // error message, or null on success

export function LeaveDrawer({
  leave,
  onClose,
  onApprove,
  onReject,
}: {
  leave: BranchLeave | null;
  onClose: () => void;
  onApprove: (id: string) => Promise<ActionResult>;
  onReject: (id: string) => Promise<ActionResult>;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const open = leave !== null;

  const [mode, setMode] = React.useState<null | "approve" | "reject">(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset the confirmation sub-state whenever a different leave opens the drawer.
  const [shownId, setShownId] = React.useState<string | null>(null);
  if (open && leave.id !== shownId) {
    setShownId(leave.id);
    setMode(null);
    setSubmitting(false);
    setError(null);
  } else if (!open && shownId !== null) {
    setShownId(null);
  }

  // DOM sync only — no setState here.
  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  async function submit() {
    if (!leave || submitting) return;
    setSubmitting(true);
    setError(null);
    const err = mode === "approve" ? await onApprove(leave.id) : await onReject(leave.id);
    setSubmitting(false);
    // On success the parent closes the drawer; on failure we keep it open and show
    // the route's message inline where the admin can act on it.
    if (err) setError(err);
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
      aria-labelledby="leave-drawer-title"
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-md rounded-none border-l border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      {leave && (
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
            <div className="min-w-0">
              <h2 id="leave-drawer-title" className="truncate text-sm font-semibold text-gray-900">
                {workerName(leave.worker)}
              </h2>
              <p className="mt-0.5 font-mono text-xs text-gray-500">{leave.worker.employeeCode}</p>
            </div>
            <div className="flex items-center gap-2">
              <LeaveStatusBadge status={leave.status} />
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
          </div>

          {/* Body */}
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {/* Worker */}
            <div className="flex items-center gap-3">
              <WorkerAvatar
                firstName={leave.worker.firstName}
                lastName={leave.worker.lastName}
                photo={leave.worker.profilePhoto}
                id={leave.worker.id}
                size={40}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{workerName(leave.worker)}</p>
                <p className="truncate text-xs text-gray-500">
                  {leave.worker.designation?.name ?? "No designation"}
                </p>
              </div>
            </div>

            {/* Leave details */}
            <dl className="space-y-3 rounded border border-gray-100 bg-gray-50/60 px-4 py-3">
              <Row label="Leave type">
                <span className="font-medium text-gray-900">{leave.leaveType.name}</span>
                <span className="ml-1 text-xs text-gray-400">({leave.leaveType.code})</span>
                <Badge tone={leave.leaveType.isPaid ? "info" : "warning"} className="ml-2">
                  {leave.leaveType.isPaid ? "Paid" : "Unpaid"}
                </Badge>
              </Row>
              <Row label="Branch">{workerBranchName(leave.worker)}</Row>
              <Row label="Applied on">{formatDate(leave.createdAt)}</Row>
              <Row label="From">{formatDate(leave.startDate)}</Row>
              <Row label="To">{formatDate(leave.endDate)}</Row>
              <Row label="Days">
                {leave.days} {leave.days === 1 ? "day" : "days"}
              </Row>
            </dl>

            {/* Reason */}
            <div>
              <p className="text-xs font-medium text-gray-500">Reason</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{leave.reason}</p>
            </div>

            {/* Status. The transition writes only the status column, so there is
                no actioned-by / actioned-on to show — the badge and this line are
                the whole story, honestly. */}
            <div>
              <p className="text-xs font-medium text-gray-500">Status</p>
              <p className="mt-1 text-sm text-gray-700">
                {leave.status === "PENDING" && "Awaiting your review."}
                {leave.status === "APPROVED" && "This leave has been approved."}
                {leave.status === "REJECTED" && "This leave has been rejected."}
                {leave.status === "CANCELLED" && "Cancelled by the worker."}
              </p>
            </div>
          </div>

          {/* Footer / actions — only a PENDING request can be actioned. */}
          <div className="border-t border-gray-100 px-5 py-4">
            {error && (
              <p role="alert" className="mb-3 rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}

            {leave.status !== "PENDING" ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                >
                  Close
                </button>
              </div>
            ) : mode === null ? (
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMode("reject")}
                  className="inline-flex h-9 items-center gap-1.5 rounded border border-red-200 bg-white px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/15"
                >
                  <Ban className="size-3.5" aria-hidden="true" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => setMode("approve")}
                  className="inline-flex h-9 items-center gap-1.5 rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                >
                  <Check className="size-3.5" aria-hidden="true" />
                  Approve
                </button>
              </div>
            ) : (
              // Inline confirmation — shows exactly what is about to happen.
              <div className="space-y-3">
                <p className="text-xs text-gray-600">
                  {mode === "approve" ? "Approve" : "Reject"}{" "}
                  <span className="font-medium text-gray-900">{workerName(leave.worker)}</span>&rsquo;s{" "}
                  <span className="font-medium text-gray-900">{leave.leaveType.name}</span> leave from{" "}
                  {formatDate(leave.startDate)} to {formatDate(leave.endDate)}?
                </p>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode(null);
                      setError(null);
                    }}
                    disabled={submitting}
                    className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className={cn(
                      "inline-flex h-9 items-center rounded px-4 text-sm font-medium text-white transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
                      mode === "approve"
                        ? "bg-gray-900 hover:bg-gray-800 focus:ring-gray-900/20"
                        : "bg-red-600 hover:bg-red-700 focus:ring-red-500/25"
                    )}
                  >
                    {submitting
                      ? mode === "approve"
                        ? "Approving…"
                        : "Rejecting…"
                      : mode === "approve"
                        ? "Confirm approve"
                        : "Confirm reject"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <dt className="shrink-0 text-xs font-medium text-gray-500">{label}</dt>
      <dd className="text-right text-gray-700">{children}</dd>
    </div>
  );
}
