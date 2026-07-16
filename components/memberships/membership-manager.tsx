"use client";

// OWNER: Gauransh
// MODULE: Membership Management (manager / orchestrator)
// FLOW  : One client shell for the Super Admin membership page. Loads analytics
//         (GET /admin/memberships/analytics) and the plan table (GET /admin/
//         memberships/plans, backend search/filters/pagination). Create/edit/delete
//         reuse the existing plan endpoints; after any mutation the plans AND the
//         analytics refetch — no page reload, filters/pagination preserved. Clicking
//         a plan opens its customers drawer.
// ACCESS: SUPER_ADMIN, OWNER (page-guarded; endpoints re-check).

import * as React from "react";
import { Plus, X, Check, Search, RotateCw, Star, Layers, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { TableSkeleton } from "@/components/dashboard/loading-skeleton";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { MembershipAnalyticsCards } from "./analytics-cards";
import { PlanFormDialog } from "./plan-form-dialog";
import { PlanCustomersDrawer } from "./plan-customers-drawer";
import { PlanRowActions } from "./plan-row-actions";
import {
  TIERS, TIER_TONE, money,
  type Analytics, type ApiEnvelope, type Paginated, type PlanRow,
} from "./types";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const inputCls = "h-9 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-700 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5";

type FormMode = "create" | "edit" | "view";
type Filters = { tier: string; status: string; minPrice: string; maxPrice: string; minValidity: string };
const EMPTY_FILTERS: Filters = { tier: "", status: "", minPrice: "", maxPrice: "", minValidity: "" };

export function MembershipManager() {
  // ── Analytics ─────────────────────────────────────────────────────────────
  const [analytics, setAnalytics] = React.useState<Analytics | null>(null);

  // ── Plan table (current page only) ────────────────────────────────────────
  const [rows, setRows] = React.useState<PlanRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [term, setTerm] = React.useState("");
  const [committedSearch, setCommittedSearch] = React.useState("");
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);

  // Separate reload triggers so a page step-back never double-fetches the table.
  const [analyticsKey, setAnalyticsKey] = React.useState(0);
  const [plansKey, setPlansKey] = React.useState(0);
  const reloadAnalytics = React.useCallback(() => setAnalyticsKey((k) => k + 1), []);
  const reloadPlans = React.useCallback(() => setPlansKey((k) => k + 1), []);
  const reloadAll = React.useCallback(() => { setAnalyticsKey((k) => k + 1); setPlansKey((k) => k + 1); }, []);

  // Dialogs / toast
  const [formMode, setFormMode] = React.useState<FormMode | null>(null);
  const [formPlan, setFormPlan] = React.useState<PlanRow | null>(null);
  const [drawerPlan, setDrawerPlan] = React.useState<PlanRow | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<PlanRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Debounced backend search (reset to page 1).
  React.useEffect(() => {
    if (term === committedSearch) return;
    const t = setTimeout(() => { setCommittedSearch(term); setPage(1); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term, committedSearch]);

  // Analytics — refetched with the plans after any mutation (reloadKey).
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(API.admin.membershipAnalytics);
        const json = (await res.json()) as ApiEnvelope<Analytics>;
        if (!cancelled && res.ok && json.success && json.data) setAnalytics(json.data);
      } catch {
        /* cards simply stay on their last value on a transient failure */
      }
    })();
    return () => { cancelled = true; };
  }, [analyticsKey]);

  // Plan table — backend-driven; aborts the in-flight request to avoid races/dupes.
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
      if (filters.tier) params.set("tier", filters.tier);
      if (filters.status) params.set("isActive", filters.status); // "true" | "false"
      if (filters.minPrice) params.set("minPrice", filters.minPrice);
      if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
      if (filters.minValidity) params.set("minValidity", filters.minValidity);
      try {
        const res = await fetch(`${API.admin.membershipPlans}?${params.toString()}`, { signal: ac.signal });
        const json = (await res.json()) as ApiEnvelope<Paginated<PlanRow>>;
        if (res.ok && json.success && json.data) {
          setRows(json.data.items); setTotal(json.data.total); setTotalPages(json.data.totalPages);
        } else {
          setError(json.message || "Could not load membership plans"); setRows([]);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("Could not reach the server. Please try again."); setRows([]);
      } finally {
        if (abortRef.current === ac) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [page, committedSearch, filters, plansKey]);

  function setFilter(key: keyof Filters, value: string) { setFilters((f) => ({ ...f, [key]: value })); setPage(1); }
  function resetAll() { setTerm(""); setCommittedSearch(""); setFilters(EMPTY_FILTERS); setPage(1); }
  const hasFilters = Boolean(committedSearch || filters.tier || filters.status || filters.minPrice || filters.maxPrice || filters.minValidity);

  // After a mutation: analytics always refreshes; the table steps back a page if the
  // last row was removed (that page change refetches it), else reloads in place.
  // Filters/search/scroll are preserved.
  function afterMutation(message: string, removed = false) {
    setToast(message);
    reloadAnalytics();
    if (removed && rows.length === 1 && page > 1) setPage((p) => p - 1);
    else reloadPlans();
  }

  async function confirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(API.admin.membershipPlan(pendingDelete.id), { method: "DELETE" });
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !json.success) {
        // e.g. 409 "Cannot deactivate — N active subscriber(s)" — show it, keep open.
        setDeleteError(json.message || "Could not delete this plan");
        return;
      }
      setPendingDelete(null);
      afterMutation("Deleted Successfully", true);
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

  const popularId = analytics?.mostPopularPlan?.id ?? null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-5">
      {/* Header + Add Membership Plan (top-right, existing Button). */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Memberships</h1>
          <p className="mt-0.5 text-sm text-gray-500">Plans, analytics and members.</p>
        </div>
        <Button type="button" onClick={() => { setFormPlan(null); setFormMode("create"); }}>
          <Plus aria-hidden="true" /> Add Membership Plan
        </Button>
      </div>

      {toast && (
        <div role="status" aria-live="polite" className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <p className="flex items-center gap-2 text-xs text-gray-700"><Check className="size-3.5 shrink-0 text-green-600" aria-hidden="true" />{toast}</p>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"><X className="size-3.5" /></button>
        </div>
      )}

      {analytics && <MembershipAnalyticsCards analytics={analytics} />}

      {/* Filter toolbar — every control maps to a backend query param. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search plans…" aria-label="Search plans" className={cn(inputCls, "w-full pl-8 pr-8")} />
          {term && <button type="button" onClick={() => setTerm("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="size-3.5" /></button>}
        </div>
        <select aria-label="Filter by tier" value={filters.tier} onChange={(e) => setFilter("tier", e.target.value)} className={inputCls}>
          <option value="">All tiers</option>
          {TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select aria-label="Filter by status" value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className={inputCls}>
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <input type="number" min={0} value={filters.minPrice} onChange={(e) => setFilter("minPrice", e.target.value)} placeholder="Min ₹" aria-label="Minimum price" className={cn(inputCls, "w-24")} />
        <input type="number" min={0} value={filters.maxPrice} onChange={(e) => setFilter("maxPrice", e.target.value)} placeholder="Max ₹" aria-label="Maximum price" className={cn(inputCls, "w-24")} />
        <input type="number" min={0} value={filters.minValidity} onChange={(e) => setFilter("minValidity", e.target.value)} placeholder="Min days" aria-label="Minimum validity" className={cn(inputCls, "w-24")} />
        {hasFilters && (
          <button type="button" onClick={resetAll} className="inline-flex h-9 items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-600 transition hover:bg-gray-50"><RotateCw className="size-3.5" aria-hidden="true" /> Reset</button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>{total} {total === 1 ? "plan" : "plans"}</CardTitle></CardHeader>

        {loading ? (
          <div className="p-4"><TableSkeleton rows={PAGE_SIZE} cols={10} /></div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <AlertTriangle className="size-6 text-red-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-gray-900">Could not load plans</p>
            <p className="mt-1 text-xs text-gray-500">{error}</p>
            <button type="button" onClick={reloadAll} className="mt-3 inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50">Retry</button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Layers} title={hasFilters ? "No plans match your filters" : "No membership plans yet"} description={hasFilters ? "Try a different search or filter." : "Add your first plan to get started."} action={!hasFilters ? (<Button type="button" onClick={() => { setFormPlan(null); setFormMode("create"); }}><Plus aria-hidden="true" /> Add Membership Plan</Button>) : undefined} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Plan</TH><TH>Tier</TH><TH className="text-right">Price</TH><TH className="text-right">Validity</TH>
                <TH className="text-right">Discount</TH><TH className="text-right">Wallet</TH><TH>Status</TH>
                <TH className="text-right">Members</TH><TH className="text-right">Revenue</TH><TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((p) => (
                <TR key={p.id}>
                  <TD>
                    <button type="button" onClick={() => setDrawerPlan(p)} className="text-left focus:outline-none focus:underline">
                      <span className="flex items-center gap-1.5 font-medium text-gray-900">
                        {p.name}
                        {popularId === p.id && <Badge tone="warning"><Star className="mr-0.5 inline size-2.5" aria-hidden="true" />Most Popular</Badge>}
                      </span>
                    </button>
                  </TD>
                  <TD><Badge tone={TIER_TONE[p.tier]}>{p.tier}</Badge></TD>
                  <TD className="text-right text-gray-800">{money(p.price)}</TD>
                  <TD className="text-right text-gray-600">{p.validityDays}d</TD>
                  <TD className="text-right text-gray-600">{p.discountPercent}%</TD>
                  <TD className="text-right text-gray-600">{money(p.walletCredit)}</TD>
                  <TD><Badge tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</Badge></TD>
                  <TD className="text-right text-gray-700">{p.totalMembers} <span className="text-[11px] text-gray-400">({p.activeMembers} active)</span></TD>
                  <TD className="text-right text-gray-800">{money(p.revenue)}</TD>
                  <TD className="text-right">
                    <PlanRowActions
                      plan={p}
                      onView={(pl) => setDrawerPlan(pl)}
                      onEdit={(pl) => { setFormPlan(pl); setFormMode("edit"); }}
                      onDelete={(pl) => { setPendingDelete(pl); setDeleteError(null); }}
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

      {formMode && (
        <PlanFormDialog
          mode={formMode}
          plan={formPlan}
          onClose={() => setFormMode(null)}
          onSaved={(m) => { setFormMode(null); afterMutation(m); }}
        />
      )}

      <PlanCustomersDrawer plan={drawerPlan} onClose={() => setDrawerPlan(null)} />

      {/* Delete confirm */}
      <dialog
        ref={confirmRef}
        onCancel={(e) => { e.preventDefault(); if (!deleting) setPendingDelete(null); }}
        onClick={(e) => { if (e.target === confirmRef.current && !deleting) setPendingDelete(null); }}
        className="w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
      >
        {pendingDelete && (
          <div className="p-5">
            <h2 className="text-sm font-semibold text-gray-900">Delete membership plan</h2>
            <p className="mt-1 text-xs text-gray-500">Deactivate <span className="font-medium text-gray-700">{pendingDelete.name}</span>? Plans with active subscribers cannot be removed.</p>
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
