"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Portfolio (UI) — per-section editor
// PURPOSE: Give every EDITABLE profile section (bio, experience, languages,
//          certificates, and new gallery work) its own independent Edit button that
//          submits through the EXISTING approval engine — nothing goes live here.
//   • Backend interaction: reads the worker's own change requests
//     (GET /worker/portfolio-requests) to show each section's status, and submits new
//     ones through the shared PortfolioRequestModal (POST /worker/portfolio-requests).
//   • Business flow: a section awaiting review is shown with a Pending badge and its
//     Edit button is DISABLED — the backend also refuses a duplicate, so the two can
//     never disagree. Approved/Rejected/Needs-changes badges reflect the last review.
//   • Live values are never mutated by this component.
// ============================================================================

import * as React from "react";
import { Pencil, Check, X, Clock } from "lucide-react";
import { API } from "@/lib/endpoints";
import { Badge } from "@/components/shared/ui";
import { PortfolioRequestModal } from "./portfolio-request-modal";
import { STATUS_CONFIG, type PortfolioRequest, type PortfolioRequestType } from "./request-types";
import type { PortfolioSummary } from "./types";

type Envelope<T> = { success: boolean; message: string; data?: T };
type Paginated<T> = { items: T[]; total: number; page: number; limit: number; totalPages: number };

// The sections editable through the approval modal (skills use the skill-rating flow;
// there is no enum value for display name / photo / visibility, so they are absent —
// a request that could never be applied would be misleading).
type SectionDef = { type: PortfolioRequestType; label: string; describe: (s: PortfolioSummary) => string; repeatable?: boolean };
const SECTIONS: SectionDef[] = [
  { type: "BIO", label: "Professional bio", describe: (s) => s.bio?.trim() || "Not set yet" },
  { type: "EXPERIENCE", label: "Experience", describe: (s) => `${s.experienceYears ?? 0} year${(s.experienceYears ?? 0) === 1 ? "" : "s"}` },
  { type: "LANGUAGE", label: "Languages", describe: (s) => (s.languages.length ? s.languages.join(", ") : "None added") },
  { type: "CERTIFICATE", label: "Certificates", describe: (s) => (s.certificates.length ? s.certificates.join(", ") : "None added") },
  // Gallery additions are repeatable — a pending piece never blocks adding another.
  { type: "GALLERY", label: "Portfolio work", describe: () => "Submit a new before/after piece", repeatable: true },
];

export function PortfolioSectionEditor({ summary }: { summary: PortfolioSummary }) {
  const [requests, setRequests] = React.useState<PortfolioRequest[]>([]);
  const [editing, setEditing] = React.useState<PortfolioRequestType | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  // Load the worker's own requests once, to derive each section's status.
  React.useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`${API.worker.portfolioRequests}?limit=100`, { signal: ac.signal });
        const body = (await res.json()) as Envelope<Paginated<PortfolioRequest>>;
        if (res.ok && body.success && body.data) setRequests(body.data.items);
      } catch {
        /* status simply shows nothing on a transient failure — Edit still works */
      }
    })();
    return () => ac.abort();
  }, []);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Latest request per section (requests arrive newest-first).
  const latestByType = React.useMemo(() => {
    const map = new Map<PortfolioRequestType, PortfolioRequest>();
    for (const r of requests) if (!map.has(r.type)) map.set(r.type, r);
    return map;
  }, [requests]);
  const hasPending = React.useCallback(
    (type: PortfolioRequestType) => requests.some((r) => r.type === type && r.status === "PENDING"),
    [requests]
  );

  // A new request lands in local state so the section flips to Pending instantly.
  function handleCreated(request: PortfolioRequest) {
    setRequests((prev) => [request, ...prev]);
    setEditing(null);
    setToast("Submitted for approval — pending review.");
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Edit your profile</p>
      </div>
      <p className="text-xs text-gray-500">Every change is reviewed by an admin before it goes live.</p>

      {toast && (
        <div role="status" aria-live="polite" className="mt-3 flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="flex items-center gap-2 text-xs text-gray-700"><Check className="size-3.5 shrink-0 text-green-600" aria-hidden="true" />{toast}</p>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="rounded p-0.5 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700"><X className="size-3.5" /></button>
        </div>
      )}

      <ul className="mt-4 divide-y divide-gray-100">
        {SECTIONS.map((section) => {
          const latest = latestByType.get(section.type);
          const pending = hasPending(section.type);
          // Only the single-value sections disable Edit while pending; gallery is
          // repeatable, so its Edit stays enabled.
          const editDisabled = pending && !section.repeatable;
          return (
            <li key={section.type} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-800">{section.label}</p>
                  {latest && <Badge tone={STATUS_CONFIG[latest.status].tone}>{STATUS_CONFIG[latest.status].label}</Badge>}
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-500">{section.describe(summary)}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(section.type)}
                disabled={editDisabled}
                aria-label={`Edit ${section.label}`}
                title={editDisabled ? "A change is awaiting review" : `Edit ${section.label}`}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editDisabled ? <Clock className="size-3.5" aria-hidden="true" /> : <Pencil className="size-3.5" aria-hidden="true" />}
                {editDisabled ? "Pending" : "Edit"}
              </button>
            </li>
          );
        })}
      </ul>

      {/* One shared modal, locked to the section the worker clicked. */}
      <PortfolioRequestModal
        open={editing !== null}
        summary={summary}
        lockedType={editing ?? undefined}
        onClose={() => setEditing(null)}
        onCreated={handleCreated}
      />
    </div>
  );
}
