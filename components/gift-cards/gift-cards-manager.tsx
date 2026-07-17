"use client";

// OWNER: Gauransh
// MODULE: Marketing — Gift Cards manager
// PURPOSE: The Marketing Manager's gift-card workspace — analytics cards + a backend
//          driven table (search / status / type filters + pagination) with issue,
//          edit and activate/deactivate via the EXISTING gift-card endpoints.
//   • Backend interaction: GET /admin/gift-cards (+ analytics), POST/PATCH via the
//     dialog; deactivate/activate is a PATCH of `status` (ACTIVE⇄CANCELLED).
//   • Business flow: after any mutation list + analytics refetch — no reload; filters
//     /pagination preserved. Debounced search; in-flight requests aborted.

import * as React from "react";
import { Plus, X, Check, Search, RotateCw, AlertTriangle, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { EmptyState } from "@/components/dashboard/empty-state";
import { TableSkeleton } from "@/components/dashboard/loading-skeleton";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { GiftCardAnalyticsCards } from "./gift-card-analytics-cards";
import { GiftCardFormDialog } from "./gift-card-form-dialog";
import { GiftCardDetailDrawer } from "./gift-card-detail-drawer";
import { GiftCardRowActions } from "./gift-card-row-actions";
import { CopyCodeButton } from "./copy-code-button";
import {
  TYPES, STATUSES, STATUS_TONE, money, formatDate,
  type ApiEnvelope, type GiftCardAnalytics, type GiftCardRow, type Paginated,
} from "./types";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const inputCls = "h-9 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-700 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5";

type FormMode = "create" | "edit";
type Filters = { status: string; type: string };
const EMPTY_FILTERS: Filters = { status: "", type: "" };

export function GiftCardsManager() {
  const [analytics, setAnalytics] = React.useState<GiftCardAnalytics | null>(null);
  const [rows, setRows] = React.useState<GiftCardRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [term, setTerm] = React.useState("");
  const [committedSearch, setCommittedSearch] = React.useState("");
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS);

  const [analyticsKey, setAnalyticsKey] = React.useState(0);
  const [listKey, setListKey] = React.useState(0);
  const reloadAnalytics = React.useCallback(() => setAnalyticsKey((k) => k + 1), []);
  const reloadList = React.useCallback(() => setListKey((k) => k + 1), []);

  const [formMode, setFormMode] = React.useState<FormMode | null>(null);
  const [formCard, setFormCard] = React.useState<GiftCardRow | null>(null);
  const [detail, setDetail] = React.useState<GiftCardRow | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
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

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(API.admin.giftCardAnalytics);
        const json = (await res.json()) as ApiEnvelope<GiftCardAnalytics>;
        if (!cancelled && res.ok && json.success && json.data) setAnalytics(json.data);
      } catch { /* keep last value */ }
    })();
    return () => { cancelled = true; };
  }, [analyticsKey]);

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
      if (filters.status) params.set("status", filters.status);
      if (filters.type) params.set("type", filters.type);
      try {
        const res = await fetch(`${API.admin.giftCards}?${params.toString()}`, { signal: ac.signal });
        const json = (await res.json()) as ApiEnvelope<Paginated<GiftCardRow>>;
        if (res.ok && json.success && json.data) {
          setRows(json.data.items); setTotal(json.data.total); setTotalPages(json.data.totalPages);
        } else {
          setError(json.message || "Could not load gift cards"); setRows([]);
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
  const hasFilters = Boolean(committedSearch || filters.status || filters.type);

  function afterMutation(message: string) { setToast(message); reloadAnalytics(); reloadList(); }

  // Deactivate/activate via the status field only (ACTIVE⇄CANCELLED).
  async function toggle(c: GiftCardRow) {
    if (busyId) return;
    setBusyId(c.id);
    const nextStatus = c.status === "ACTIVE" ? "CANCELLED" : "ACTIVE";
    try {
      const res = await fetch(API.admin.giftCard(c.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = (await res.json()) as ApiEnvelope<unknown>;
      if (!res.ok || !json.success) { setToast(json.message || "Could not update gift card"); return; }
      afterMutation(nextStatus === "CANCELLED" ? "Gift card deactivated" : "Gift card activated");
    } catch {
      setToast("Could not reach the server.");
    } finally {
      setBusyId(null);
    }
  }

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Gift Cards</h1>
          <p className="mt-0.5 text-sm text-gray-500">Issue, edit and track gift cards.</p>
        </div>
        <Button type="button" onClick={() => { setFormCard(null); setFormMode("create"); }}>
          <Plus aria-hidden="true" /> Add Gift Card
        </Button>
      </div>

      {toast && (
        <div role="status" aria-live="polite" className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <p className="flex items-center gap-2 text-xs text-gray-700"><Check className="size-3.5 shrink-0 text-green-600" aria-hidden="true" />{toast}</p>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="rounded p-0.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"><X className="size-3.5" /></button>
        </div>
      )}

      {analytics && <GiftCardAnalyticsCards analytics={analytics} />}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
          <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by code…" aria-label="Search gift cards" className={cn(inputCls, "w-full pl-8 pr-8")} />
          {term && <button type="button" onClick={() => setTerm("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="size-3.5" /></button>}
        </div>
        <select aria-label="Filter by status" value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className={inputCls}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select aria-label="Filter by type" value={filters.type} onChange={(e) => setFilter("type", e.target.value)} className={inputCls}>
          <option value="">All types</option>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {hasFilters && (
          <button type="button" onClick={resetAll} className="inline-flex h-9 items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-600 transition hover:bg-gray-50"><RotateCw className="size-3.5" aria-hidden="true" /> Reset</button>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>{total} {total === 1 ? "gift card" : "gift cards"}</CardTitle></CardHeader>

        {loading ? (
          <div className="p-4"><TableSkeleton rows={PAGE_SIZE} cols={11} /></div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <AlertTriangle className="size-6 text-red-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-gray-900">Could not load gift cards</p>
            <p className="mt-1 text-xs text-gray-500">{error}</p>
            <button type="button" onClick={reloadList} className="mt-3 inline-flex h-9 items-center rounded border border-gray-200 bg-white px-3 text-sm text-gray-600 transition hover:bg-gray-50">Retry</button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Gift} title={hasFilters ? "No gift cards match your filters" : "No gift cards yet"} description={hasFilters ? "Try a different search or filter." : "Issue your first gift card to get started."} action={!hasFilters ? (<Button type="button" onClick={() => { setFormCard(null); setFormMode("create"); }}><Plus aria-hidden="true" /> Add Gift Card</Button>) : undefined} />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Code</TH><TH>Type</TH><TH className="text-right">Value</TH><TH className="text-right">Balance</TH><TH>Status</TH>
                <TH>Purchased by</TH><TH>Owner</TH><TH>Expiry</TH><TH className="text-right">Redemptions</TH><TH>Created</TH><TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setDetail(c)} className="font-mono font-semibold text-gray-900 focus:outline-none focus:underline">{c.code}</button>
                      <CopyCodeButton code={c.code} />
                    </div>
                  </TD>
                  <TD><Badge tone={c.type === "DIGITAL" ? "info" : "neutral"}>{c.type}</Badge></TD>
                  <TD className="text-right text-gray-800">{money(c.value)}</TD>
                  <TD className="text-right text-gray-700">{money(c.balance)}</TD>
                  <TD><Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge></TD>
                  <TD className="text-xs text-gray-600">{c.purchasedByName ?? "—"}</TD>
                  <TD className="text-xs text-gray-500">{c.ownerName ?? c.purchasedByName ?? "—"}</TD>
                  <TD className="whitespace-nowrap text-xs text-gray-500">{formatDate(c.expiresAt)}</TD>
                  <TD className="text-right text-gray-700">{c._count.redemptions}</TD>
                  <TD className="whitespace-nowrap text-xs text-gray-500">{formatDate(c.purchasedAt)}</TD>
                  <TD className="text-right">
                    <GiftCardRowActions
                      card={c}
                      onView={setDetail}
                      onEdit={(x) => { setFormCard(x); setFormMode("edit"); }}
                      onToggle={toggle}
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
        <GiftCardFormDialog mode={formMode} card={formCard} onClose={() => setFormMode(null)} onSaved={(m) => { setFormMode(null); afterMutation(m); }} />
      )}

      <GiftCardDetailDrawer card={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
