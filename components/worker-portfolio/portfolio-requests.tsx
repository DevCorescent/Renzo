"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Portfolio Change Requests (UI) — worker tracker
//
// The worker's "Portfolio Requests" section: every change they have submitted, its
// status, the admin's comment and a small timeline. The worker never edits the live
// portfolio here — they submit a request (modal) and track it. A pending request is
// read-only; after a rejection or a needs-changes they can simply submit a new one.
//
// Fetches once on mount (requests + the current summary, the latter to pre-fill the
// draft). Writes mutate the in-memory list from the API's authoritative response —
// no refetch, no page refresh.
// ============================================================================

import * as React from "react";
import { FilePlus2, Check, X, AlertTriangle, RefreshCw, Clock3, ClipboardList } from "lucide-react";
import { Badge } from "@/components/shared/ui";
import { API } from "@/lib/endpoints";
import { PortfolioRequestModal } from "./portfolio-request-modal";
import {
  STATUS_CONFIG,
  TYPE_LABELS,
  describeRequest,
  formatDate,
  type PortfolioRequest,
  type PortfolioRequestStatus,
} from "./request-types";
import type { PortfolioSummary } from "./types";

type Envelope<T> = { success: boolean; message: string; data?: T };
type Paginated<T> = { items: T[]; total: number; page: number; limit: number; totalPages: number };

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; summary: PortfolioSummary; requests: PortfolioRequest[] };

const STATUS_ORDER: PortfolioRequestStatus[] = ["PENDING", "NEEDS_CHANGES", "APPROVED", "REJECTED"];

export function PortfolioRequests() {
  const [phase, setPhase] = React.useState<Phase>({ kind: "loading" });
  const [modalOpen, setModalOpen] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const [reqRes, sumRes] = await Promise.all([
        fetch(`${API.worker.portfolioRequests}?limit=100`, { signal }),
        fetch(API.worker.portfolioSummary, { signal }),
      ]);
      const reqBody = (await reqRes.json()) as Envelope<Paginated<PortfolioRequest>>;
      const sumBody = (await sumRes.json()) as Envelope<PortfolioSummary>;
      if (!sumRes.ok || !sumBody.success || !sumBody.data) {
        setPhase({ kind: "error", message: sumBody.message || "Could not load your portfolio" });
        return;
      }
      setPhase({
        kind: "ready",
        summary: sumBody.data,
        requests: reqBody.success && reqBody.data ? reqBody.data.items : [],
      });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setPhase({ kind: "error", message: "Could not reach the server. Check your connection." });
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    void (async () => { await load(controller.signal); })();
    return () => controller.abort();
  }, [load]);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function handleCreated(request: PortfolioRequest) {
    setPhase((p) => (p.kind === "ready" ? { ...p, requests: [request, ...p.requests] } : p));
    setModalOpen(false);
    setToast("Request submitted for approval.");
  }

  const requests = phase.kind === "ready" ? phase.requests : [];
  const counts = STATUS_ORDER.map((s) => ({ status: s, count: requests.filter((r) => r.status === s).length }));

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Portfolio requests</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Propose changes to your professional portfolio. A Branch Admin reviews each one before it goes live.
          </p>
        </div>
        {phase.kind === "ready" && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 self-start rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 sm:self-auto"
          >
            <FilePlus2 className="size-4" aria-hidden="true" />
            New request
          </button>
        )}
      </div>

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

      {phase.kind === "loading" && <ListSkeleton />}

      {phase.kind === "error" && (
        <div className="flex flex-col items-center justify-center rounded border border-red-100 bg-red-50/50 px-6 py-14 text-center">
          <AlertTriangle className="size-6 text-red-400" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold text-gray-900">Something went wrong</h3>
          <p className="mt-1 text-xs text-gray-500">{phase.message}</p>
          <button
            type="button"
            onClick={() => { setPhase({ kind: "loading" }); load(); }}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {phase.kind === "ready" && (
        <>
          {/* Status summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {counts.map(({ status, count }) => (
              <div key={status} className="rounded-lg border border-gray-200 bg-white p-3">
                <p className="text-lg font-semibold text-gray-900">{count}</p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  {STATUS_CONFIG[status].label}
                </p>
              </div>
            ))}
          </div>

          {requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-gray-50 text-gray-400 ring-1 ring-gray-200">
                <ClipboardList className="size-6" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-sm font-semibold text-gray-900">No requests yet</h3>
              <p className="mt-1 max-w-sm text-xs text-gray-500">
                Submit a change to your bio, experience, languages, certificates or portfolio work for approval.
              </p>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="mt-5 inline-flex h-9 items-center gap-1.5 rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              >
                <FilePlus2 className="size-4" aria-hidden="true" />
                New request
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {requests.map((r) => (
                <RequestCard key={r.id} request={r} />
              ))}
            </ul>
          )}
        </>
      )}

      {phase.kind === "ready" && (
        <PortfolioRequestModal
          open={modalOpen}
          summary={phase.summary}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

function RequestCard({ request }: { request: PortfolioRequest }) {
  const status = STATUS_CONFIG[request.status];
  const reviewed = request.reviewedAt !== null;

  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{TYPE_LABELS[request.type]}</p>
          <p className="mt-0.5 truncate text-xs text-gray-500">{describeRequest(request.type, request.payload)}</p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      {/* Admin comment on reject / needs-changes */}
      {request.reviewNote && (
        <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <span className="font-medium text-gray-700">Admin comment:</span> {request.reviewNote}
        </p>
      )}

      {/* Timeline */}
      <ol className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
        <TimelineRow label="Submitted" date={formatDate(request.createdAt)} done />
        <TimelineRow
          label={reviewed ? status.label : "Awaiting review"}
          date={reviewed ? formatDate(request.reviewedAt) : "—"}
          done={reviewed}
        />
      </ol>
    </li>
  );
}

function TimelineRow({ label, date, done }: { label: string; date: string; done: boolean }) {
  return (
    <li className="flex items-center gap-2 text-xs">
      <span
        className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full ${
          done ? "bg-gray-900 text-white" : "border border-gray-300 text-transparent"
        }`}
      >
        {done ? <Check className="size-2.5" /> : <Clock3 className="size-2.5" />}
      </span>
      <span className="font-medium text-gray-700">{label}</span>
      <span className="ml-auto text-gray-400">{date}</span>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
      ))}
    </div>
  );
}
