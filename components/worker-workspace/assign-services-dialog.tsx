"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Workspace — Assign Services
//
// The missing client half of the service-assignment flow. The backend has always
// exposed it — GET/PUT /api/v1/admin/workers/[id]/services (replace-all semantics,
// catalogue validation, branch isolation, RBAC for SUPER_ADMIN/OWNER/BRANCH_ADMIN)
// — but nothing on the page ever called it, so the Services tab could only DISPLAY
// assignments and never create them. This dialog wires that existing contract to a
// multi-select, reusing the endpoints verbatim; it adds no new API and duplicates
// no business logic.
//
// FLOW
//   open  → GET /admin/services (active catalogue) to list selectable options,
//           pre-checking the worker's current services (already loaded server-side
//           and passed in, so no extra round trip to read the current set).
//   save  → PUT /admin/workers/[id]/services { serviceIds } — the whole desired set.
//   done  → router.refresh() re-runs the server page, so Worker Details, the
//           Services tab and the profile "Services Offered" card all reflect the
//           new set immediately, with no manual reload and no local cache to go
//           stale. Mirrors AddPortfolioWorkButton, the sibling write in this module.
// ============================================================================

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Scissors, Search, X } from "lucide-react";
import { API } from "@/lib/endpoints";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
};

type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// Only the fields the picker renders — the catalogue row carries far more, but a
// narrow shape keeps this component honest about what it actually depends on.
type CatalogueService = {
  id: string;
  name: string;
  basePrice: number;
  duration: number;
  isActive: boolean;
  category: { id: string; name: string } | null;
};

// Page size is capped at 100 by the route; loop until every page is drained so a
// salon with more than 100 services still shows its whole catalogue.
const PAGE_SIZE = 100;

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function AssignServicesButton({
  workerId,
  assignedServiceIds,
}: {
  workerId: string;
  /** The worker's current services, from the same server fetch that renders the tab. */
  assignedServiceIds: string[];
}) {
  const router = useRouter();
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [open, setOpen] = React.useState(false);

  const [catalogue, setCatalogue] = React.useState<CatalogueService[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [query, setQuery] = React.useState("");

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Native <dialog> is driven imperatively; keep the element's open state in sync
  // with React's so Escape / backdrop closes and the button both agree.
  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Drain the active catalogue, page by page. Aborts cleanly if the dialog closes
  // mid-flight so a late response can never overwrite a fresh open. Every setState
  // here runs AFTER the first await — the loading flag is raised in openDialog — so
  // the effect never sets state synchronously (the project's lint forbids that).
  const loadCatalogue = React.useCallback(async (signal: AbortSignal) => {
    try {
      const all: CatalogueService[] = [];
      let page = 1;
      let totalPages = 1;
      do {
        const res = await fetch(
          `${API.admin.services}?isActive=true&limit=${PAGE_SIZE}&page=${page}`,
          { signal }
        );
        const body = (await res.json()) as ApiEnvelope<Paginated<CatalogueService>>;
        if (!res.ok || !body.success || !body.data) {
          throw new Error(body.message || "Could not load services");
        }
        all.push(...body.data.items);
        totalPages = body.data.totalPages;
        page += 1;
      } while (page <= totalPages);

      setCatalogue(all);
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Could not load services");
    } finally {
      setLoading(false);
    }
  }, []);

  function openDialog() {
    // Seed the selection from the current assignments every time, so re-opening
    // after a save reflects the persisted set rather than a stale draft. Loading and
    // the cleared catalogue are raised HERE (an event handler) so the fetch effect
    // itself never sets state synchronously.
    setSelected(new Set(assignedServiceIds));
    setQuery("");
    setError(null);
    setCatalogue([]);
    setLoading(true);
    setOpen(true);
  }

  function closeDialog() {
    if (saving) return;
    setOpen(false);
  }

  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    // Awaited inside an async IIFE so no state is set synchronously in the effect
    // body — the same shape ScheduleTab uses for its lazy fetch.
    void (async () => { await loadCatalogue(controller.signal); })();
    return () => controller.abort();
  }, [open, loadCatalogue]);

  function toggle(serviceId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      // Replace-all: the endpoint expects the complete desired set, not a delta.
      const res = await fetch(API.admin.workerServices(workerId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceIds: [...selected] }),
      });
      const body = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !body.success) {
        // Surface the field-level 422 detail when present, otherwise the route's
        // message — a 400/401/403/404/409/500 all arrive here and never fail silently.
        const fieldError = body.errors ? Object.values(body.errors).flat()[0] : null;
        throw new Error(fieldError || body.message || "Could not save services");
      }

      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save services");
    } finally {
      setSaving(false);
    }
  }

  // Client-side filter over the already-loaded catalogue — a convenience for long
  // service lists, never a second request.
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalogue;
    return catalogue.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.category?.name.toLowerCase().includes(q) ?? false)
    );
  }, [catalogue, query]);

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover)"
      >
        <Scissors className="size-3.5" aria-hidden="true" />
        Assign services
      </button>

      <dialog
        ref={dialogRef}
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeDialog();
        }}
        className="w-[calc(100vw-2rem)] max-w-lg rounded-xl border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)"
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 dark:border-(--sa-border)">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-(--sa-text)">
              Assign services
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-(--sa-text-2)">
              Select every service this worker can perform.
            </p>
          </div>
          <button
            type="button"
            onClick={closeDialog}
            disabled={saving}
            aria-label="Close"
            className="rounded p-1 text-gray-400 transition hover:bg-gray-100 disabled:opacity-50 dark:text-(--sa-muted) dark:hover:bg-(--sa-hover)"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {error && (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
            >
              {error}
            </p>
          )}

          {/* Search — filters the loaded catalogue only. */}
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400 dark:text-(--sa-muted)" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search services"
              className="h-9 w-full rounded-lg border border-gray-200 pl-8 pr-2.5 text-sm outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 dark:border-(--sa-border) dark:bg-(--sa-surface-2) dark:text-(--sa-text) dark:placeholder:text-(--sa-muted)"
            />
          </div>

          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-5 animate-spin text-gray-400 dark:text-(--sa-muted)" aria-hidden="true" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400 dark:text-(--sa-muted)">
                {catalogue.length === 0 ? "No active services in the catalogue." : "No services match your search."}
              </p>
            ) : (
              filtered.map((service) => {
                const checked = selected.has(service.id);
                return (
                  <label
                    key={service.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5 transition hover:bg-gray-50 dark:border-(--sa-border) dark:hover:bg-(--sa-hover)"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(service.id)}
                      className="size-4 shrink-0 rounded border-gray-300 text-gray-900 focus:ring-gray-900/20 dark:border-(--sa-border)"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900 dark:text-(--sa-text)">
                        {service.name}
                      </span>
                      <span className="block truncate text-xs text-gray-400 dark:text-(--sa-muted)">
                        {service.category?.name ?? "Uncategorised"} · {service.duration} min
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-gray-700 dark:text-(--sa-text-2)">
                      {money(service.basePrice)}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-5 py-4 dark:border-(--sa-border)">
          <span className="text-xs text-gray-500 dark:text-(--sa-text-2)">
            {selected.size} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={closeDialog}
              disabled={saving}
              className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-600 disabled:opacity-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover)"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || loading}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 disabled:opacity-60 dark:bg-white dark:text-gray-950 dark:hover:bg-white/90"
            >
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {saving ? "Saving…" : "Save services"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
