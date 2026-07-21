"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Branch Admin — Portfolio Requests (review drawer)
//
// A native <dialog> right-sheet: the reviewer sees the worker, the current-vs-
// requested diff, then decides. Approve/Reject/Needs-Changes are two-step — the
// action reveals a confirmation (approve) or a required comment (reject / needs-
// changes) before firing, so nothing is actioned by a stray click. The parent runs
// the Server Action, closes the drawer on success, and hands an inline error back
// on failure. Reason-required for reject and needs-changes is enforced here AND by
// the route — this is the courtesy layer.
// ============================================================================

import * as React from "react";
import { X, Check, Ban, Undo2 } from "lucide-react";
import { Badge } from "@/components/shared/ui";
import { WorkerAvatar } from "@/components/workers/worker-ui";
import { cn } from "@/lib/utils";
import {
  STATUS_CONFIG,
  TYPE_LABELS,
  formatDate,
} from "@/components/worker-portfolio/request-types";
import { RequestDiff } from "./request-diff";
import { workerName, workerBranchName, type AdminRequestRow, type ReviewAction } from "./types";

export function RequestDrawer({
  request,
  onClose,
  onReview,
}: {
  request: AdminRequestRow | null;
  onClose: () => void;
  /** Runs the Server Action. Returns an error message, or null on success. */
  onReview: (id: string, action: ReviewAction, note: string) => Promise<string | null>;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const open = request !== null;

  const [mode, setMode] = React.useState<ReviewAction | null>(null);
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset the confirmation sub-state whenever a different request opens the drawer —
  // render-phase reset keyed on the shown id (the pattern the lint rule requires).
  const [shownId, setShownId] = React.useState<string | null>(null);
  if (open && request.id !== shownId) {
    setShownId(request.id);
    setMode(null);
    setNote("");
    setSubmitting(false);
    setError(null);
  } else if (!open && shownId !== null) {
    setShownId(null);
  }

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  async function submit() {
    if (!request || !mode || submitting) return;
    // Reject / needs-changes must carry a reason — the worker needs to know why.
    if ((mode === "REJECT" || mode === "NEEDS_CHANGES") && !note.trim()) {
      setError("Please add a comment for the worker.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const err = await onReview(request.id, mode, note);
    setSubmitting(false);
    if (err) setError(err); // keep the drawer open and show the route's message
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
      aria-labelledby="pr-drawer-title"
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-md rounded-none border-l border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40 dark:border-[var(--sa-border)] dark:bg-[var(--sa-surface)]"
    >
      {request && (
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 dark:border-[var(--sa-border)]">
            <div className="flex min-w-0 items-center gap-3">
              <WorkerAvatar
                firstName={request.worker.firstName}
                lastName={request.worker.lastName}
                photo={request.worker.profilePhoto}
                id={request.worker.id}
                size={40}
              />
              <div className="min-w-0">
                <h2 id="pr-drawer-title" className="truncate text-sm font-semibold text-gray-900 dark:text-[var(--sa-text)]">
                  {workerName(request.worker)}
                </h2>
                <p className="truncate text-xs text-gray-500 dark:text-[var(--sa-muted)]">
                  {request.worker.designation?.name ?? "—"} · {workerBranchName(request.worker)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              aria-label="Close"
              className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50 dark:hover:bg-[var(--sa-hover)] dark:hover:text-[var(--sa-text)]"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[var(--sa-muted)]">Request</p>
                <p className="text-sm font-medium text-gray-900 dark:text-[var(--sa-text)]">{TYPE_LABELS[request.type]}</p>
              </div>
              <Badge tone={STATUS_CONFIG[request.status].tone}>{STATUS_CONFIG[request.status].label}</Badge>
            </div>

            <p className="text-xs text-gray-400 dark:text-[var(--sa-muted)]">
              Submitted {formatDate(request.createdAt)}
              {request.reviewedAt && ` · reviewed ${formatDate(request.reviewedAt)}`}
            </p>

            {/* The mandatory comparison */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-[var(--sa-muted)]">
                Current vs requested
              </p>
              <RequestDiff type={request.type} previous={request.previousValue} payload={request.payload} />
            </div>

            {/* Prior decision note, if any */}
            {request.reviewNote && (
              <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text-2)]">
                <span className="font-medium text-gray-700 dark:text-[var(--sa-text)]">Comment:</span> {request.reviewNote}
              </p>
            )}
          </div>

          {/* Footer / actions */}
          <div className="border-t border-gray-100 px-5 py-4 dark:border-[var(--sa-border)]">
            {error && (
              <p role="alert" className="mb-3 rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}

            {request.status !== "PENDING" ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text-2)] dark:hover:bg-[var(--sa-hover)]"
                >
                  Close
                </button>
              </div>
            ) : mode === null ? (
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setMode("NEEDS_CHANGES"); setError(null); }}
                  className="inline-flex h-9 items-center gap-1.5 rounded border border-blue-200 bg-white px-3 text-sm font-medium text-blue-600 transition hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
                >
                  <Undo2 className="size-3.5" aria-hidden="true" />
                  Needs changes
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("REJECT"); setError(null); }}
                  className="inline-flex h-9 items-center gap-1.5 rounded border border-red-200 bg-white px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/15"
                >
                  <Ban className="size-3.5" aria-hidden="true" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => { setMode("APPROVE"); setError(null); }}
                  className="inline-flex h-9 items-center gap-1.5 rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                >
                  <Check className="size-3.5" aria-hidden="true" />
                  Approve
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-600 dark:text-[var(--sa-text-2)]">
                  {mode === "APPROVE"
                    ? "Approving publishes this change to the live portfolio immediately."
                    : mode === "REJECT"
                      ? "Rejecting discards the change. Tell the worker why."
                      : "Return the request so the worker can revise and resubmit."}
                </p>

                <textarea
                  value={note}
                  onChange={(e) => { setNote(e.target.value); setError(null); }}
                  disabled={submitting}
                  rows={2}
                  aria-label="Comment"
                  placeholder={mode === "APPROVE" ? "Comment (optional)" : "Comment (required)"}
                  className="w-full rounded border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 disabled:bg-gray-50 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text)] dark:placeholder:text-[var(--sa-muted)] dark:disabled:bg-[var(--sa-surface)]"
                />

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => { setMode(null); setError(null); }}
                    disabled={submitting}
                    className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text-2)] dark:hover:bg-[var(--sa-hover)]"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className={cn(
                      "inline-flex h-9 items-center rounded px-4 text-sm font-medium text-white transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
                      mode === "APPROVE"
                        ? "bg-gray-900 hover:bg-gray-800 focus:ring-gray-900/20"
                        : mode === "REJECT"
                          ? "bg-red-600 hover:bg-red-700 focus:ring-red-500/25"
                          : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/25"
                    )}
                  >
                    {submitting
                      ? "Working…"
                      : mode === "APPROVE"
                        ? "Confirm approve"
                        : mode === "REJECT"
                          ? "Confirm reject"
                          : "Return for changes"}
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
