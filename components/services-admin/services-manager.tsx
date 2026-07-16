"use client";

// OWNER: Gauransh
// MODULE: Services & Categories Management

// ============================================================================
// The Services Management shell for BOTH Super Admin and Branch Admin. It fetches
// exclusively from the existing GET /api/v1/admin/services with backend query params
// (search, categoryId, gender, isActive, isPopular, page, limit) — all filtering,
// searching and pagination are SERVER-side; the client holds only the current page.
//
// UX contract: search is debounced (one request per pause, previous aborted so no
// duplicate/racing requests); changing a filter, searching, paging or running a CRUD
// action never navigates or reloads — it refetches the current view into state, so
// scroll position, filters and pagination are preserved. After create/edit/delete the
// affected data is refetched and the existing toast shown.
//
// Actions are role-gated by `capabilities`, which the server page derives from the
// backend RBAC — the UI never offers what the role cannot do (Add Category / full
// edit / Delete for a Branch Admin).
// ============================================================================

import * as React from "react";
import Image from "next/image";
import { Plus, X, Check, Search, RotateCw, Scissors, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { TableSkeleton } from "@/components/dashboard/loading-skeleton";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { ServiceFormDialog } from "./service-form-dialog";
import { ServiceRowActions } from "./service-row-actions";
import {
  GENDERS, money, formatDate,
  type ApiEnvelope, type CategoryRef, type CategoryRow, type Paginated,
  type ServiceCapabilities, type ServiceRow,
} from "./types";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const inputCls =
  "h-9 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-700 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5";

type FormMode = "create" | "edit" | "view";
type Filters = { categoryId: string; gender: string; isActive: string; isPopular: string };
const EMPTY_FILTERS: Filters = { categoryId: "", gender: "", isActive: "", isPopular: "" };

export function ServicesManager({
  title,
  subtitle,
  capabilities,
}: {
  /** Optional — omitted when embedded under a tab (the tab supplies the heading). */
  title?: string;
  subtitle?: string;
  capabilities: ServiceCapabilities;
}) {
  // ── Table data (current page only) ────────────────────────────────────────
  const [rows, setRows] = React.useState<ServiceRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // ── Filters (search is debounced into `committedSearch`) ──────────────────
  const [term, setTerm] = React.useState("");
  const [committedSearch, setCommittedSearch] = React.useState("");
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);

  // ── Category catalog for the filter + form dropdowns (live, never hardcoded) ─
  const [categories, setCategories] = React.useState<CategoryRef[]>([]);

  // ── Dialogs / toast ───────────────────────────────────────────────────────
  const [formMode, setFormMode] = React.useState<FormMode | null>(null);
  const [formService, setFormService] = React.useState<ServiceRow | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<ServiceRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Debounce the search box → one committed value per pause; reset to page 1.
  React.useEffect(() => {
    if (term === committedSearch) return;
    const t = setTimeout(() => { setCommittedSearch(term); setPage(1); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term, committedSearch]);

  // Explicit reload triggers — bumping a key re-runs the fetch effect. This keeps the
  // setState-ful fetch inside an async IIFE in the effect body (the project's pattern)
  // rather than calling a setState-ful function synchronously from an effect.
  const [servicesReloadKey, setServicesReloadKey] = React.useState(0);
  const reloadServices = React.useCallback(() => setServicesReloadKey((k) => k + 1), []);

  // Load the category catalog once (for the filter + form dropdowns). Live, never
  // hardcoded. Category management lives in its own tab, which remounts this manager
  // on return, so a one-time fetch stays fresh.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${API.admin.categories}?limit=100`);
        const json = (await res.json()) as ApiEnvelope<Paginated<CategoryRow>>;
        if (!cancelled && res.ok && json.success && json.data) {
          setCategories(json.data.items.map((c) => ({ id: c.id, name: c.name, slug: c.slug })));
        }
      } catch {
        /* filter dropdown simply stays empty on a transient failure */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // The single source of table data. Backend-driven; aborts the in-flight request so
  // rapid filter/search/page changes can never resolve out of order or duplicate.
  const abortRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    void (async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (committedSearch.trim()) params.set("search", committedSearch.trim());
      if (filters.categoryId) params.set("categoryId", filters.categoryId);
      if (filters.gender) params.set("gender", filters.gender);
      if (filters.isActive) params.set("isActive", filters.isActive);
      if (filters.isPopular) params.set("isPopular", filters.isPopular);

      try {
        const res = await fetch(`${API.admin.services}?${params.toString()}`, { signal: ac.signal });
        const json = (await res.json()) as ApiEnvelope<Paginated<ServiceRow>>;
        if (res.ok && json.success && json.data) {
          setRows(json.data.items);
          setTotal(json.data.total);
          setTotalPages(json.data.totalPages);
        } else {
          setError(json.message || "Could not load services");
          setRows([]);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // superseded by a newer request
        setError("Could not reach the server. Please try again.");
        setRows([]);
      } finally {
        if (abortRef.current === ac) setLoading(false);
      }
    })();

    return () => ac.abort();
  }, [page, committedSearch, filters, servicesReloadKey]);

  function setFilter(key: keyof Filters, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }
  function resetAll() {
    setTerm(""); setCommittedSearch(""); setFilters(EMPTY_FILTERS); setPage(1);
  }
  const hasFilters = Boolean(committedSearch || filters.categoryId || filters.gender || filters.isActive || filters.isPopular);

  // After a successful mutation: refetch the current page, stepping back if the last
  // row on a page was removed. Filters/search/scroll are untouched.
  function afterMutation(message: string, removed = false) {
    setToast(message);
    // Stepping back a page re-runs the fetch effect via the page dep; otherwise bump
    // the reload key. Filters/search/scroll are untouched either way.
    if (removed && rows.length === 1 && page > 1) setPage((p) => p - 1);
    else reloadServices();
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(API.admin.service(pendingDelete.id), { method: "DELETE" });
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !json.success) {
        setDeleteError(json.message || "Could not delete this service");
        return;
      }
      setPendingDelete(null);
      afterMutation("Service deleted", true);
    } catch {
      setDeleteError("Could not reach the server.");
    } finally {
      setDeleting(false);
    }
  }

  const confirmRef = React.useRef<HTMLDialogElement>(null);
  const confirmOpen = pendingDelete !== null;
  React.useEffect(() => {
    const el = confirmRef.current;
    if (!el) return;
    if (confirmOpen && !el.open) el.showModal();
    else if (!confirmOpen && el.open) el.close();
  }, [confirmOpen]);

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-5">
      {/* Header — the title block is shown only when NOT embedded under a tab; the
          Add Service action always sits top-right beside the filters. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {title ? (
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
          </div>
        ) : <div />}
        {capabilities.createService && (
          <Button type="button" onClick={() => { setFormService(null); setFormMode("create"); }}>
            <Plus aria-hidden="true" /> Add Service
          </Button>
        )}
      </div>

      {toast && (
        <div role="status" aria-live="polite" className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <p className="flex items-center gap-2 text-xs text-gray-700"><Check className="size-3.5 shrink-0 text-green-600" aria-hidden="true" />{toast}</p>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"><X className="size-3.5" /></button>
        </div>
      )}

      {/* Filter toolbar — every control is a backend query param. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search services…" aria-label="Search services" className={cn(inputCls, "w-full pl-8 pr-8")} />
          {term && <button type="button" onClick={() => setTerm("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="size-3.5" /></button>}
        </div>

        <select aria-label="Filter by category" value={filters.categoryId} onChange={(e) => setFilter("categoryId", e.target.value)} className={inputCls}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select aria-label="Filter by gender" value={filters.gender} onChange={(e) => setFilter("gender", e.target.value)} className={inputCls}>
          <option value="">All genders</option>
          {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
        <select aria-label="Filter by status" value={filters.isActive} onChange={(e) => setFilter("isActive", e.target.value)} className={inputCls}>
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select aria-label="Filter by popular" value={filters.isPopular} onChange={(e) => setFilter("isPopular", e.target.value)} className={inputCls}>
          <option value="">Popular & not</option>
          <option value="true">Popular</option>
          <option value="false">Not popular</option>
        </select>
        {hasFilters && (
          <button type="button" onClick={resetAll} className="inline-flex h-9 items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-600 transition hover:bg-gray-50">
            <RotateCw className="size-3.5" aria-hidden="true" /> Reset
          </button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>{total} {total === 1 ? "service" : "services"}</CardTitle></CardHeader>

        {loading ? (
          <div className="p-4"><TableSkeleton rows={PAGE_SIZE} cols={9} /></div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <AlertTriangle className="size-6 text-red-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-gray-900">Could not load services</p>
            <p className="mt-1 text-xs text-gray-500">{error}</p>
            <button type="button" onClick={reloadServices} className="mt-3 inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50">Retry</button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Scissors}
            title={hasFilters ? "No services match your filters" : "No services yet"}
            description={hasFilters ? "Try a different search or filter." : "Add your first service to get started."}
            action={!hasFilters && capabilities.createService ? (
              <Button type="button" onClick={() => { setFormService(null); setFormMode("create"); }}><Plus aria-hidden="true" /> Add Service</Button>
            ) : undefined}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Service</TH><TH>Category</TH><TH>Subcategory</TH>
                <TH className="text-right">Price</TH><TH className="text-right">Duration</TH>
                <TH>Gender</TH><TH>Status</TH><TH>Popular</TH><TH>Created</TH><TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <span className="relative size-9 shrink-0 overflow-hidden rounded bg-gray-100 ring-1 ring-gray-200">
                        {r.image ? <Image src={r.image} alt="" fill sizes="36px" className="object-cover" /> : <span className="flex size-full items-center justify-center text-gray-300"><Scissors className="size-4" /></span>}
                      </span>
                      <div className="min-w-0"><p className="truncate font-medium text-gray-900">{r.name}</p><p className="truncate font-mono text-[11px] text-gray-400">{r.slug}</p></div>
                    </div>
                  </TD>
                  <TD className="text-xs text-gray-500">{r.category?.name ?? "—"}</TD>
                  <TD className="text-xs text-gray-500">{r.subCategory?.name ?? "—"}</TD>
                  <TD className="text-right text-gray-800">{money(r.basePrice)}</TD>
                  <TD className="text-right text-gray-600">{r.duration}m</TD>
                  <TD className="text-xs capitalize text-gray-500">{r.gender.toLowerCase()}</TD>
                  <TD><Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Inactive"}</Badge></TD>
                  <TD>{r.isPopular ? <Badge tone="info">Popular</Badge> : <span className="text-xs text-gray-300">—</span>}</TD>
                  <TD className="whitespace-nowrap text-xs text-gray-500">{formatDate(r.createdAt)}</TD>
                  <TD className="text-right">
                    <ServiceRowActions
                      row={r}
                      capabilities={capabilities}
                      onView={(row) => { setFormService(row); setFormMode("view"); }}
                      onEdit={(row) => { setFormService(row); setFormMode("edit"); }}
                      onDelete={(row) => { setPendingDelete(row); setDeleteError(null); }}
                    />
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}

        {!loading && !error && rows.length > 0 && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
            <span>{from}–{to} of {total}</span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 disabled:opacity-40">Previous</button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </Card>

      {/* Service create / edit / view */}
      {formMode && (
        <ServiceFormDialog
          mode={formMode}
          service={formService}
          capabilities={capabilities}
          categories={categories}
          onClose={() => setFormMode(null)}
          onSaved={(m) => { setFormMode(null); afterMutation(m); }}
        />
      )}

      {/* Delete confirm */}
      <dialog
        ref={confirmRef}
        onCancel={(e) => { e.preventDefault(); if (!deleting) setPendingDelete(null); }}
        onClick={(e) => { if (e.target === confirmRef.current && !deleting) setPendingDelete(null); }}
        className="w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
      >
        {pendingDelete && (
          <div className="p-5">
            <h2 className="text-sm font-semibold text-gray-900">Delete service</h2>
            <p className="mt-1 text-xs text-gray-500">Delete <span className="font-medium text-gray-700">{pendingDelete.name}</span>? This cannot be undone.</p>
            {deleteError && <p role="alert" className="mt-2 rounded border border-red-100 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">{deleteError}</p>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setPendingDelete(null)} disabled={deleting} className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={deleting} className="inline-flex h-9 items-center rounded bg-red-600 px-4 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60">{deleting ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
