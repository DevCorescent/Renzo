"use client";

// OWNER: Gauransh
// MODULE: Marketing — Coupons manager
// PURPOSE: The Marketing Manager's coupon workspace — analytics cards + a backend
//          driven table (search / status / type / applicableTo filters + pagination)
//          with full CRUD via the EXISTING coupon endpoints.
//   • Backend interaction: GET /admin/coupons (+ analytics), POST/PATCH/DELETE via
//     the shared dialogs; activate/deactivate is a PATCH of isActive.
//   • Business flow: after any mutation the list AND analytics refetch — no reload,
//     filters/pagination/scroll preserved. Search is debounced; requests are aborted
//     so rapid changes never race or duplicate.
//   • Error handling: backend messages surface via toast / inline; a blocked delete
//     keeps its dialog open.

import * as React from "react";
import { Plus, X, Check, Search, RotateCw, AlertTriangle, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { TableSkeleton } from "@/components/dashboard/loading-skeleton";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { CouponAnalyticsCards } from "./coupon-analytics-cards";
import { CouponFormDialog } from "./coupon-form-dialog";
import { CouponDetailDrawer } from "./coupon-detail-drawer";
import { CouponRowActions } from "./coupon-row-actions";
import {
  TYPES, APPLICABLE, STATUS_META, couponStatus, couponValue, formatDate, validityText, applicableLabel,
  type ApiEnvelope, type CouponAnalytics, type CouponRow, type Paginated,
} from "./types";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const inputCls = "h-9 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-700 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5";

type FormMode = "create" | "edit";
type Filters = { status: string; type: string; applicableTo: string };
const EMPTY_FILTERS: Filters = { status: "", type: "", applicableTo: "" };

export function CouponsManager() {
  const [analytics, setAnalytics] = React.useState<CouponAnalytics | null>(null);
  const [rows, setRows] = React.useState<CouponRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  // Stable clock stamped per fetch — used to derive status/validity in render without
  // calling Date.now() during render (the project's purity rule).
  const [now, setNow] = React.useState(0);

  const [term, setTerm] = React.useState("");
  const [committedSearch, setCommittedSearch] = React.useState("");
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);

  const [analyticsKey, setAnalyticsKey] = React.useState(0);
  const [listKey, setListKey] = React.useState(0);
  const reloadAnalytics = React.useCallback(() => setAnalyticsKey((k) => k + 1), []);
  const reloadList = React.useCallback(() => setListKey((k) => k + 1), []);

  const [formMode, setFormMode] = React.useState<FormMode | null>(null);
  const [formCoupon, setFormCoupon] = React.useState<CouponRow | null>(null);
  const [detail, setDetail] = React.useState<CouponRow | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<CouponRow | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  React.useEffect(() => {
    if (term === committedSearch) return;
    const t = setTimeout(() => { setCommittedSearch(term); setPage(1); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term, committedSearch]);

  // Analytics — refetched after any mutation.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(API.admin.couponAnalytics);
        const json = (await res.json()) as ApiEnvelope<CouponAnalytics>;
        if (!cancelled && res.ok && json.success && json.data) setAnalytics(json.data);
      } catch { /* cards keep their last value */ }
    })();
    return () => { cancelled = true; };
  }, [analyticsKey]);

  // Coupon table — backend-driven, aborts in-flight requests.
  const abortRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    void (async () => {
      setLoading(true);
      setError(null);
      setNow(Date.now());
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (committedSearch.trim()) params.set("search", committedSearch.trim());
      if (filters.status) params.set("status", filters.status);
      if (filters.type) params.set("type", filters.type);
      if (filters.applicableTo) params.set("applicableTo", filters.applicableTo);
      try {
        const res = await fetch(`${API.admin.coupons}?${params.toString()}`, { signal: ac.signal });
        const json = (await res.json()) as ApiEnvelope<Paginated<CouponRow>>;
        if (res.ok && json.success && json.data) {
          setRows(json.data.items); setTotal(json.data.total); setTotalPages(json.data.totalPages);
        } else {
          setError(json.message || "Could not load coupons"); setRows([]);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("Could not reach the server. Please try again."); setRows([]);
      } finally {
        if (abortRef.current === ac) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [page, committedSearch, filters, listKey]);

  function setFilter(key: keyof Filters, value: string) { setFilters((f) => ({ ...f, [key]: value })); setPage(1); }
  function resetAll() { setTerm(""); setCommittedSearch(""); setFilters(EMPTY_FILTERS); setPage(1); }
  const hasFilters = Boolean(committedSearch || filters.status || filters.type || filters.applicableTo);

  function afterMutation(message: string, removed = false) {
    setToast(message);
    reloadAnalytics();
    if (removed && rows.length === 1 && page > 1) setPage((p) => p - 1);
    else reloadList();
  }

  // Activate / deactivate = PATCH isActive only. Backend message surfaces on failure.
  async function toggleActive(c: CouponRow) {
    if (busyId) return;
    setBusyId(c.id);
    try {
      const res = await fetch(API.admin.coupon(c.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !json.success) { setToast(json.message || "Could not update coupon"); return; }
      afterMutation(c.isActive ? "Coupon deactivated" : "Coupon activated");
    } catch {
      setToast("Could not reach the server.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || busyId) return;
    setBusyId(pendingDelete.id);
    setDeleteError(null);
    try {
      const res = await fetch(API.admin.coupon(pendingDelete.id), { method: "DELETE" });
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !json.success) { setDeleteError(json.message || "Could not delete this coupon"); return; }
      setPendingDelete(null);
      afterMutation("Coupon deleted", true);
    } catch {
      setDeleteError("Could not reach the server.");
    } finally {
      setBusyId(null);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Coupons</h1>
          <p className="mt-0.5 text-sm text-gray-500">Create, edit and track discount coupons.</p>
        </div>
        <Button type="button" onClick={() => { setFormCoupon(null); setFormMode("create"); }}>
          <Plus aria-hidden="true" /> Add Coupon
        </Button>
      </div>

      {toast && (
        <div role="status" aria-live="polite" className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <p className="flex items-center gap-2 text-xs text-gray-700"><Check className="size-3.5 shrink-0 text-green-600" aria-hidden="true" />{toast}</p>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"><X className="size-3.5" /></button>
        </div>
      )}

      {analytics && <CouponAnalyticsCards analytics={analytics} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search code or description…" aria-label="Search coupons" className={cn(inputCls, "w-full pl-8 pr-8")} />
          {term && <button type="button" onClick={() => setTerm("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="size-3.5" /></button>}
        </div>
        <select aria-label="Filter by status" value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className={inputCls}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="upcoming">Upcoming</option>
          <option value="expired">Expired</option>
          <option value="disabled">Disabled</option>
        </select>
        <select aria-label="Filter by type" value={filters.type} onChange={(e) => setFilter("type", e.target.value)} className={inputCls}>
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select aria-label="Filter by applicability" value={filters.applicableTo} onChange={(e) => setFilter("applicableTo", e.target.value)} className={inputCls}>
          <option value="">All applicability</option>
          {APPLICABLE.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        {hasFilters && (
          <button type="button" onClick={resetAll} className="inline-flex h-9 items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-600 transition hover:bg-gray-50"><RotateCw className="size-3.5" aria-hidden="true" /> Reset</button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>{total} {total === 1 ? "coupon" : "coupons"}</CardTitle></CardHeader>

        {loading ? (
          <div className="p-4"><TableSkeleton rows={PAGE_SIZE} cols={12} /></div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <AlertTriangle className="size-6 text-red-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-gray-900">Could not load coupons</p>
            <p className="mt-1 text-xs text-gray-500">{error}</p>
            <button type="button" onClick={reloadList} className="mt-3 inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50">Retry</button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Ticket} title={hasFilters ? "No coupons match your filters" : "No coupons yet"} description={hasFilters ? "Try a different search or filter." : "Create your first coupon to get started."} action={!hasFilters ? (<Button type="button" onClick={() => { setFormCoupon(null); setFormMode("create"); }}><Plus aria-hidden="true" /> Add Coupon</Button>) : undefined} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Code</TH><TH>Description</TH><TH>Type</TH><TH className="text-right">Value</TH><TH>Applicable</TH>
                <TH className="text-right">Limit</TH><TH className="text-right">Used</TH><TH className="text-right">Left</TH><TH className="text-right">Customers</TH>
                <TH>Valid from</TH><TH>Valid until</TH><TH>Status</TH><TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((c) => {
                const st = couponStatus(c, now);
                const remaining = c.usageLimit != null ? Math.max(0, c.usageLimit - c.usedCount) : null;
                return (
                  <TR key={c.id}>
                    <TD><button type="button" onClick={() => setDetail(c)} className="font-mono font-semibold text-gray-900 focus:outline-none focus:underline">{c.code}</button></TD>
                    <TD className="max-w-40 truncate text-xs text-gray-500" title={c.description ?? ""}>{c.description ?? "—"}</TD>
                    <TD><Badge tone={c.type === "FLAT" ? "info" : "warning"}>{c.type}</Badge></TD>
                    <TD className="text-right text-gray-800">{couponValue(c)}</TD>
                    <TD className="text-xs text-gray-500">{applicableLabel(c.applicableTo)}</TD>
                    <TD className="text-right text-gray-500">{c.usageLimit ?? "∞"}</TD>
                    <TD className="text-right text-gray-700">{c.usedCount}</TD>
                    <TD className="text-right text-gray-500">{remaining ?? "∞"}</TD>
                    <TD className="text-right text-gray-700">{c.customersUsed}</TD>
                    <TD className="whitespace-nowrap text-xs text-gray-500">{formatDate(c.validFrom)}</TD>
                    <TD className="whitespace-nowrap text-xs text-gray-500" title={validityText(c, now)}>{formatDate(c.validUntil)}</TD>
                    <TD><Badge tone={STATUS_META[st].tone}>{STATUS_META[st].label}</Badge></TD>
                    <TD className="text-right">
                      <CouponRowActions
                        coupon={c}
                        onView={setDetail}
                        onEdit={(x) => { setFormCoupon(x); setFormMode("edit"); }}
                        onToggleActive={toggleActive}
                        onDelete={(x) => { setPendingDelete(x); setDeleteError(null); }}
                      />
                    </TD>
                  </TR>
                );
              })}
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
        <CouponFormDialog mode={formMode} coupon={formCoupon} onClose={() => setFormMode(null)} onSaved={(m) => { setFormMode(null); afterMutation(m); }} />
      )}

      <CouponDetailDrawer coupon={detail} onClose={() => setDetail(null)} />

      <dialog
        ref={confirmRef}
        onCancel={(e) => { e.preventDefault(); if (!busyId) setPendingDelete(null); }}
        onClick={(e) => { if (e.target === confirmRef.current && !busyId) setPendingDelete(null); }}
        className="w-[calc(100vw-2rem)] max-w-sm rounded-lg border border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
      >
        {pendingDelete && (
          <div className="p-5">
            <h2 className="text-sm font-semibold text-gray-900">Delete coupon</h2>
            <p className="mt-1 text-xs text-gray-500">Delete <span className="font-mono font-medium text-gray-700">{pendingDelete.code}</span>? It will be deactivated and hidden from customers.</p>
            {deleteError && <p role="alert" className="mt-2 rounded border border-red-100 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">{deleteError}</p>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setPendingDelete(null)} disabled={Boolean(busyId)} className="inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={Boolean(busyId)} className="inline-flex h-9 items-center rounded bg-red-600 px-4 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60">{busyId ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
