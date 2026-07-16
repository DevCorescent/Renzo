"use client";

// OWNER: Gauransh
// MODULE: Super Admin Leave Management

// ============================================================================
// The approval workspace: a native <dialog> right-hand sheet (focus trap, top
// layer, Escape for free). It shows the employee, the leave, the reason, the
// worker's PREVIOUS leave history and their CURRENT balance — the last two fetched
// on open from read-only endpoints (list?workerId= and /leaves/balance), never
// recomputed here. Approve / Reject run the parent's Server Action (PATCH status);
// the parent owns the toast and closes on success. There is no "Needs Changes" or
// attachment control because the schema has neither — surfacing them would be fake.
// ============================================================================

import * as React from "react";
import Link from "next/link";
import { X, Check, Ban, ExternalLink } from "lucide-react";
import { Badge } from "@/components/shared/ui";
import { WorkerAvatar } from "@/components/workers/worker-ui";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { LeaveStatusBadge } from "@/components/branch-leaves/leaves-ui";
import {
  formatDate, workerName, workerBranchName,
  type BranchLeave, type LeaveStatus, type LeaveBalanceRow,
} from "@/components/branch-leaves/types";

type ActionResult = string | null; // error message, or null on success
type Envelope<T> = { success: boolean; message: string; data?: T };
type Paged<T> = { items: T[] };

export function ReviewModal({
  leave,
  status,
  onClose,
  onApprove,
  onReject,
}: {
  leave: BranchLeave | null;
  status: LeaveStatus;
  onClose: () => void;
  onApprove: (id: string) => Promise<ActionResult>;
  onReject: (id: string) => Promise<ActionResult>;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const open = leave !== null;

  const [mode, setMode] = React.useState<null | "approve" | "reject">(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [history, setHistory] = React.useState<BranchLeave[]>([]);
  const [balances, setBalances] = React.useState<LeaveBalanceRow[]>([]);
  const [loadingExtra, setLoadingExtra] = React.useState(false);

  // Reset the confirmation sub-state when a different leave opens the sheet.
  const [shownId, setShownId] = React.useState<string | null>(null);
  if (open && leave.id !== shownId) {
    setShownId(leave.id);
    setMode(null);
    setSubmitting(false);
    setError(null);
  } else if (!open && shownId !== null) {
    setShownId(null);
  }

  // DOM open/close sync only — no setState here.
  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Load history + balance for the worker on open (async IIFE — the project's
  // accepted pattern for effect fetches). Both endpoints are branch-scoped server-
  // side, so a super admin sees them and a branch admin only within their branch.
  const workerId = leave?.worker.id ?? null;
  React.useEffect(() => {
    if (!workerId) return;
    let cancelled = false;
    void (async () => {
      setLoadingExtra(true);
      setHistory([]);
      setBalances([]);
      try {
        const [hRes, bRes] = await Promise.all([
          fetch(`${API.admin.leaves}?workerId=${encodeURIComponent(workerId)}&limit=5&sortOrder=desc`),
          fetch(`${API.admin.leavesBalance}?workerId=${encodeURIComponent(workerId)}`),
        ]);
        const hJson = (await hRes.json()) as Envelope<Paged<BranchLeave>>;
        const bJson = (await bRes.json()) as Envelope<{ balances: LeaveBalanceRow[] }>;
        if (cancelled) return;
        if (hRes.ok && hJson.success && hJson.data) setHistory(hJson.data.items);
        if (bRes.ok && bJson.success && bJson.data) setBalances(bJson.data.balances);
      } catch {
        // History/balance are enrichment — a failure leaves them empty, the core
        // review (approve/reject) still works.
      } finally {
        if (!cancelled) setLoadingExtra(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workerId]);

  async function submit() {
    if (!leave || submitting) return;
    setSubmitting(true);
    setError(null);
    const err = mode === "approve" ? await onApprove(leave.id) : await onReject(leave.id);
    setSubmitting(false);
    if (err) setError(err); // keep the sheet open, show the route's message inline
  }

  // Previous history excludes the request being reviewed.
  const priorLeaves = leave ? history.filter((h) => h.id !== leave.id) : [];

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); if (!submitting) onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current && !submitting) onClose(); }}
      aria-labelledby="review-title"
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full max-w-md rounded-none border-l border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      {leave && (
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
            <div className="min-w-0">
              <h2 id="review-title" className="truncate text-sm font-semibold text-gray-900">{workerName(leave.worker)}</h2>
              <p className="mt-0.5 font-mono text-xs text-gray-500">{leave.worker.employeeCode}</p>
            </div>
            <div className="flex items-center gap-2">
              <LeaveStatusBadge status={status} />
              <button type="button" onClick={onClose} disabled={submitting} aria-label="Close" className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50">
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {/* Employee */}
            <div className="flex items-center gap-3">
              <WorkerAvatar firstName={leave.worker.firstName} lastName={leave.worker.lastName} photo={leave.worker.profilePhoto} id={leave.worker.id} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{workerName(leave.worker)}</p>
                <p className="truncate text-xs text-gray-500">{leave.worker.designation?.name ?? "No designation"} · {workerBranchName(leave.worker)}</p>
              </div>
              {/* Reuse the existing worker profile page — no duplicate profile module. */}
              <Link href={`/super-admin/workers/${leave.worker.id}`} className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 transition hover:bg-gray-50">
                Profile <ExternalLink className="size-3" aria-hidden="true" />
              </Link>
            </div>

            {/* Leave details */}
            <dl className="space-y-3 rounded border border-gray-100 bg-gray-50/60 px-4 py-3">
              <Row label="Leave type">
                <span className="font-medium text-gray-900">{leave.leaveType.name}</span>
                <span className="ml-1 text-xs text-gray-400">({leave.leaveType.code})</span>
                <Badge tone={leave.leaveType.isPaid ? "info" : "warning"} className="ml-2">{leave.leaveType.isPaid ? "Paid" : "Unpaid"}</Badge>
              </Row>
              <Row label="Applied on">{formatDate(leave.createdAt)}</Row>
              <Row label="From">{formatDate(leave.startDate)}</Row>
              <Row label="To">{formatDate(leave.endDate)}</Row>
              <Row label="Days">{leave.days} {leave.days === 1 ? "day" : "days"}</Row>
            </dl>

            {/* Reason */}
            <div>
              <p className="text-xs font-medium text-gray-500">Reason</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{leave.reason}</p>
            </div>

            {/* Current balance (read-only) */}
            <div>
              <p className="text-xs font-medium text-gray-500">Current leave balance</p>
              {loadingExtra ? (
                <p className="mt-1 text-xs text-gray-400">Loading…</p>
              ) : balances.length === 0 ? (
                <p className="mt-1 text-xs text-gray-400">No balance recorded for this year.</p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {balances.map((b) => (
                    <li key={b.id} className="flex items-center justify-between rounded border border-gray-100 px-3 py-1.5 text-xs">
                      <span className="text-gray-700">{b.leaveType.name} <span className="text-gray-400">({b.leaveType.code})</span></span>
                      <span className="text-gray-500">
                        <span className="font-medium text-gray-900">{b.remaining}</span> left · {b.used} used · {b.allocated} total
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Previous history (read-only) */}
            <div>
              <p className="text-xs font-medium text-gray-500">Previous leave history</p>
              {loadingExtra ? (
                <p className="mt-1 text-xs text-gray-400">Loading…</p>
              ) : priorLeaves.length === 0 ? (
                <p className="mt-1 text-xs text-gray-400">No earlier leave requests.</p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {priorLeaves.map((h) => (
                    <li key={h.id} className="flex items-center justify-between rounded border border-gray-100 px-3 py-1.5 text-xs">
                      <span className="text-gray-700">{h.leaveType.code} · {formatDate(h.startDate)} → {formatDate(h.endDate)}</span>
                      <LeaveStatusBadge status={h.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Footer — only a PENDING request can be actioned. */}
          <div className="border-t border-gray-100 px-5 py-4">
            {error && <p role="alert" className="mb-3 rounded border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

            {status !== "PENDING" ? (
              <div className="flex justify-end">
                <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10">Close</button>
              </div>
            ) : mode === null ? (
              <div className="flex items-center justify-end gap-2">
                <button type="button" onClick={() => setMode("reject")} className="inline-flex h-9 items-center gap-1.5 rounded border border-red-200 bg-white px-3 text-sm font-medium text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/15">
                  <Ban className="size-3.5" aria-hidden="true" /> Reject
                </button>
                <button type="button" onClick={() => setMode("approve")} className="inline-flex h-9 items-center gap-1.5 rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20">
                  <Check className="size-3.5" aria-hidden="true" /> Approve
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-600">
                  {mode === "approve" ? "Approve" : "Reject"} <span className="font-medium text-gray-900">{workerName(leave.worker)}</span>&rsquo;s{" "}
                  <span className="font-medium text-gray-900">{leave.leaveType.name}</span> leave from {formatDate(leave.startDate)} to {formatDate(leave.endDate)}?
                </p>
                <div className="flex items-center justify-end gap-2">
                  <button type="button" onClick={() => { setMode(null); setError(null); }} disabled={submitting} className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-50">Cancel</button>
                  <button type="button" onClick={submit} disabled={submitting} className={cn(
                    "inline-flex h-9 items-center rounded px-4 text-sm font-medium text-white transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
                    mode === "approve" ? "bg-gray-900 hover:bg-gray-800 focus:ring-gray-900/20" : "bg-red-600 hover:bg-red-700 focus:ring-red-500/25"
                  )}>
                    {submitting ? (mode === "approve" ? "Approving…" : "Rejecting…") : mode === "approve" ? "Confirm approve" : "Confirm reject"}
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
