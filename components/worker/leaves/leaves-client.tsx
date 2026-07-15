"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Leaves — client orchestrator
//
// Owns every stateful concern: fetching the worker's own leaves, the summary
// derived from them, the apply modal, cancelling a pending request, the success
// toast and the error/retry path. The pieces it renders (cards, table rows,
// skeletons, empty state, modal) are dumb — this is the only file that talks to
// the API.
//
// WHY CLIENT-SIDE FETCHING. The feature is interactive by requirement: apply
// without a page reload, cancel and have the row vanish, watch the summary update.
// A Server Component cannot do that. Fetching runs against the same /api/v1/worker
// endpoints the rest of the app uses — the browser sends the renzo_token cookie
// and the route enforces WORKER RBAC, so nothing here bypasses the API layer.
//
// NO REFETCH AFTER A WRITE. POST and DELETE both return authoritative results
// (the created row; a 200 for the delete), so we mutate the in-memory list from
// those rather than re-hitting GET. That is what makes apply and cancel feel
// instant and keeps the cards and table in lock-step.
// ============================================================================

import * as React from "react";
import { CalendarPlus, Check, X, AlertTriangle, RefreshCw } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  Table,
  THead,
  TH,
  TR,
  TD,
} from "@/components/shared/ui";
import { ApplyLeaveModal } from "./apply-leave-modal";
import {
  CardsSkeleton,
  TableSkeleton,
  SummaryCards,
  EmptyState,
  LeaveStatusBadge,
} from "./leave-ui";
import {
  formatDate,
  type ApiEnvelope,
  type LeaveRow,
  type LeaveTypeOption,
  type PaginatedData,
} from "./types";

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; rows: LeaveRow[] };

export function LeavesClient({
  leaveTypes,
  today,
}: {
  leaveTypes: LeaveTypeOption[];
  today: string;
}) {
  const [phase, setPhase] = React.useState<Phase>({ kind: "loading" });
  const [modalOpen, setModalOpen] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [cancellingId, setCancellingId] = React.useState<string | null>(null);

  // Fetch the worker's leaves. Aborts if the component unmounts mid-flight so a
  // late response cannot setState on a gone component.
  //
  // It deliberately does NOT flip to `loading` itself: the first render already
  // starts in `loading`, and the one caller that wants the skeleton (Retry) sets
  // it in its click handler. Keeping the synchronous setState out of `load` is
  // also what lets the effect below call it without a cascading-render lint error,
  // and it means the silent refetch after a failed cancel doesn't blank the table.
  const load = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/v1/worker/leaves?limit=100", { signal });
      const body = (await res.json()) as ApiEnvelope<PaginatedData<LeaveRow>>;
      if (!res.ok || !body.success || !body.data) {
        setPhase({ kind: "error", message: body.message || "Could not load your leaves" });
        return;
      }
      setPhase({ kind: "ready", rows: body.data.items });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setPhase({ kind: "error", message: "Could not reach the server. Check your connection." });
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    // Wrapped in an async IIFE (the codebase's convention for effect fetches): the
    // setState lands after an await, inside a nested closure, so it never fires
    // synchronously in the effect body.
    void (async () => {
      await load(controller.signal);
    })();
    return () => controller.abort();
  }, [load]);

  // Auto-dismiss the toast.
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleCreated(leave: LeaveRow) {
    // Prepend the server's authoritative row — the list is ordered newest-first,
    // so a fresh request belongs at the top. Cards recompute from the same array.
    setPhase((p) =>
      p.kind === "ready" ? { kind: "ready", rows: [leave, ...p.rows] } : p
    );
    setModalOpen(false);
    setToast("Leave request submitted.");
  }

  async function handleCancel(id: string) {
    if (cancellingId) return;
    // A plain confirm(): there is no dialog primitive installed, and a destructive
    // one-off confirmation does not warrant building one. It is blocking and
    // accessible by default.
    const yes = window.confirm(
      "Cancel this leave request? This cannot be undone."
    );
    if (!yes) return;

    setCancellingId(id);
    try {
      const res = await fetch(`/api/v1/worker/leaves/${id}`, { method: "DELETE" });
      const body = (await res.json()) as ApiEnvelope<null>;
      if (!res.ok || !body.success) {
        // e.g. the route returns 409 if it is no longer PENDING (approved between
        // page load and now). Surface the route's own message and refetch so the
        // stale row corrects itself.
        setToast(body.message || "Could not cancel this request.");
        await load();
        return;
      }
      // Drop the row locally — no refetch needed on success.
      setPhase((p) =>
        p.kind === "ready"
          ? { kind: "ready", rows: p.rows.filter((r) => r.id !== id) }
          : p
      );
      setToast("Leave request cancelled.");
    } catch {
      setToast("Could not reach the server. Please try again.");
    } finally {
      setCancellingId(null);
    }
  }

  const rows = phase.kind === "ready" ? phase.rows : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Leaves</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Apply and track your leave requests.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 self-start rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 sm:self-auto"
        >
          <CalendarPlus className="size-4" aria-hidden="true" />
          Apply leave
        </button>
      </div>

      {/* Toast — polite, this is a confirmation not an interruption. */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2 shadow-sm"
        >
          <p className="flex items-center gap-2 text-xs text-gray-700">
            <Check className="size-3.5 shrink-0 text-green-600" aria-hidden="true" />
            {toast}
          </p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Body */}
      {phase.kind === "loading" && (
        <>
          <CardsSkeleton />
          <TableSkeleton />
        </>
      )}

      {phase.kind === "error" && (
        <div className="flex flex-col items-center justify-center rounded border border-red-100 bg-red-50/50 px-6 py-14 text-center">
          <AlertTriangle className="size-6 text-red-400" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold text-gray-900">
            Something went wrong
          </h3>
          <p className="mt-1 text-xs text-gray-500">{phase.message}</p>
          <button
            type="button"
            onClick={() => {
              setPhase({ kind: "loading" });
              load();
            }}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {phase.kind === "ready" && (
        <>
          <SummaryCards rows={rows} />

          {rows.length === 0 ? (
            <EmptyState onApply={() => setModalOpen(true)} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Leave requests</CardTitle>
              </CardHeader>
              <Table>
                <THead>
                  <tr>
                    <TH>Leave type</TH>
                    <TH>From</TH>
                    <TH>To</TH>
                    <TH>Days</TH>
                    <TH>Reason</TH>
                    <TH>Status</TH>
                    <TH>Applied on</TH>
                    <TH className="text-right">Actions</TH>
                  </tr>
                </THead>
                <tbody>
                  {rows.map((l) => (
                    <TR key={l.id}>
                      <TD className="font-medium text-gray-900">
                        {l.leaveType.name}
                        <span className="ml-1 text-[11px] font-normal text-gray-400">
                          ({l.leaveType.code})
                        </span>
                      </TD>
                      <TD className="whitespace-nowrap text-xs text-gray-600">
                        {formatDate(l.startDate)}
                      </TD>
                      <TD className="whitespace-nowrap text-xs text-gray-600">
                        {formatDate(l.endDate)}
                      </TD>
                      <TD className="text-gray-500">{l.days}</TD>
                      <TD className="max-w-[220px] truncate text-xs text-gray-500" title={l.reason}>
                        {l.reason}
                      </TD>
                      <TD>
                        <LeaveStatusBadge status={l.status} />
                        {l.status === "REJECTED" && l.rejectionReason && (
                          <p className="mt-0.5 text-[11px] text-gray-400" title={l.rejectionReason}>
                            {l.rejectionReason}
                          </p>
                        )}
                      </TD>
                      <TD className="whitespace-nowrap text-xs text-gray-500">
                        {formatDate(l.createdAt)}
                      </TD>
                      <TD className="text-right">
                        {/* Cancel is offered ONLY for PENDING — the route rejects
                            anything else with a 409, so showing it elsewhere would
                            invite an error the worker cannot act on. */}
                        {l.status === "PENDING" ? (
                          <button
                            type="button"
                            onClick={() => handleCancel(l.id)}
                            disabled={cancellingId === l.id}
                            className="text-xs font-medium text-red-600 transition hover:text-red-700 focus:outline-none focus:underline disabled:opacity-50"
                          >
                            {cancellingId === l.id ? "Cancelling…" : "Cancel"}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </>
      )}

      <ApplyLeaveModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
        leaveTypes={leaveTypes}
        today={today}
      />
    </div>
  );
}
