"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Leave Types (admin) — client orchestrator
//
// The only file that talks to the API. Owns fetching the catalog, the summary,
// search / filter / sort / pagination, the create-edit modal, the inline active
// toggle, delete, the toast and the error/retry path. The parts it renders (cards,
// toggle, badges, skeletons, modal) are dumb.
//
// WHY THE WHOLE CATALOG IS FETCHED ONCE. Leave types are a small configuration
// set — a handful of rows, not a feed. So it fetches them all (limit=100) and does
// search / filter / sort / paginate in memory. That keeps the five summary cards
// exact (they count the true set, not one page) and every interaction instant. The
// backend still supports server-side search, filter, sort and pagination for any
// API consumer — the UI simply doesn't need to round-trip for a catalog this size.
//
// NO REFETCH AFTER A WRITE. POST / PATCH / DELETE return authoritative results, so
// the in-memory catalog is mutated from them. Create and edit and toggle feel
// instant, and the cards stay in lock-step with the table.
//
// RBAC is the API's job: every request carries the renzo_token cookie and the
// route admits only SUPER_ADMIN / OWNER. Nothing here re-checks a role.
// ============================================================================

import * as React from "react";
import {
  Plus,
  Search,
  Check,
  X,
  AlertTriangle,
  RefreshCw,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
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
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import { LeaveTypeFormModal } from "./leave-type-form-modal";
import {
  SummaryCards,
  PaidBadge,
  StatusBadge,
  Toggle,
  CardsSkeleton,
  TableSkeleton,
  EmptyCatalog,
  NoMatches,
} from "./leave-types-ui";
import type {
  ActiveFilter,
  ApiEnvelope,
  LeaveType,
  PaginatedData,
  PaidFilter,
  SortKey,
  SortOrder,
} from "./types";

const PAGE_SIZE = 10;

// Stable reference for the not-ready case, so the derivations below don't see a
// brand-new [] every render and re-run needlessly.
const EMPTY: LeaveType[] = [];

type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; all: LeaveType[] };

const inputCls =
  "h-9 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5";

export function LeaveTypesClient() {
  const [phase, setPhase] = React.useState<Phase>({ kind: "loading" });

  const [search, setSearch] = React.useState("");
  const [activeFilter, setActiveFilter] = React.useState<ActiveFilter>("all");
  const [paidFilter, setPaidFilter] = React.useState<PaidFilter>("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("asc");
  const [page, setPage] = React.useState(1);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LeaveType | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const load = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`${API.admin.leaveTypes}?limit=100`, { signal });
      const body = (await res.json()) as ApiEnvelope<PaginatedData<LeaveType>>;
      if (!res.ok || !body.success || !body.data) {
        setPhase({ kind: "error", message: body.message || "Could not load leave types" });
        return;
      }
      setPhase({ kind: "ready", all: body.data.items });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      setPhase({ kind: "error", message: "Could not reach the server. Check your connection." });
    }
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      await load(controller.signal);
    })();
    return () => controller.abort();
  }, [load]);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const all = phase.kind === "ready" ? phase.all : EMPTY;

  // Derive the visible rows: filter → sort → paginate. Memoised so typing in the
  // search box doesn't re-sort the whole catalog on every keystroke needlessly.
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = all.filter((t) => {
      if (q && !t.name.toLowerCase().includes(q) && !t.code.toLowerCase().includes(q)) return false;
      if (activeFilter === "active" && !t.isActive) return false;
      if (activeFilter === "inactive" && t.isActive) return false;
      if (paidFilter === "paid" && !t.isPaid) return false;
      if (paidFilter === "unpaid" && t.isPaid) return false;
      return true;
    });

    const dir = sortOrder === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      if (sortKey === "maxPerYear") return (a.maxPerYear - b.maxPerYear) * dir;
      return a[sortKey].localeCompare(b[sortKey]) * dir;
    });
    return rows;
  }, [all, search, activeFilter, paidFilter, sortKey, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function resetToFirstPage() {
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(row: LeaveType) {
    setEditing(row);
    setModalOpen(true);
  }

  function handleSaved(saved: LeaveType, mode: "create" | "edit") {
    setPhase((p) => {
      if (p.kind !== "ready") return p;
      const all =
        mode === "create"
          ? [saved, ...p.all]
          : p.all.map((t) => (t.id === saved.id ? saved : t));
      return { kind: "ready", all };
    });
    setModalOpen(false);
    setToast(mode === "create" ? "Leave type created." : "Leave type updated.");
  }

  // Inline active toggle → PATCH { isActive }. Updates from the returned row.
  async function handleToggleActive(row: LeaveType) {
    if (busyId) return;
    setBusyId(row.id);
    try {
      const res = await fetch(API.admin.leaveType(row.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      const body = (await res.json()) as ApiEnvelope<LeaveType>;
      if (!res.ok || !body.success || !body.data) {
        setToast(body.message || "Could not update the leave type.");
        return;
      }
      const updated = body.data;
      setPhase((p) =>
        p.kind === "ready"
          ? { kind: "ready", all: p.all.map((t) => (t.id === updated.id ? updated : t)) }
          : p
      );
      setToast(updated.isActive ? "Leave type activated." : "Leave type deactivated.");
    } catch {
      setToast("Could not reach the server. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(row: LeaveType) {
    if (busyId) return;
    const yes = window.confirm(
      `Delete "${row.name}" (${row.code})? This cannot be undone.\n\nA leave type that has ever been used cannot be deleted — deactivate it instead.`
    );
    if (!yes) return;

    setBusyId(row.id);
    try {
      const res = await fetch(API.admin.leaveType(row.id), { method: "DELETE" });
      const body = (await res.json()) as ApiEnvelope<null>;
      if (!res.ok || !body.success) {
        // 409 when the type is referenced by leaves/balances — surface the route's
        // own guidance ("deactivate it instead") rather than a generic failure.
        setToast(body.message || "Could not delete the leave type.");
        return;
      }
      setPhase((p) =>
        p.kind === "ready"
          ? { kind: "ready", all: p.all.filter((t) => t.id !== row.id) }
          : p
      );
      setToast("Leave type deleted.");
    } catch {
      setToast("Could not reach the server. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  const filtersDirty = search.trim() !== "" || activeFilter !== "all" || paidFilter !== "all";

  function clearFilters() {
    setSearch("");
    setActiveFilter("all");
    setPaidFilter("all");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Leave types</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Configure the leave categories staff can request.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-9 items-center gap-1.5 self-start rounded bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900/20 sm:self-auto"
        >
          <Plus className="size-4" aria-hidden="true" />
          New leave type
        </button>
      </div>

      {/* Toast */}
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

      {/* Loading */}
      {phase.kind === "loading" && (
        <>
          <CardsSkeleton />
          <TableSkeleton />
        </>
      )}

      {/* Error */}
      {phase.kind === "error" && (
        <div className="flex flex-col items-center justify-center rounded border border-red-100 bg-red-50/50 px-6 py-14 text-center">
          <AlertTriangle className="size-6 text-red-400" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold text-gray-900">Something went wrong</h3>
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

      {/* Ready */}
      {phase.kind === "ready" && (
        <>
          <SummaryCards all={all} />

          {all.length === 0 ? (
            <EmptyCatalog onCreate={openCreate} />
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative sm:w-72">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      resetToFirstPage();
                    }}
                    placeholder="Search name or code…"
                    aria-label="Search leave types"
                    className={cn(inputCls, "w-full pl-8")}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={activeFilter}
                    onChange={(e) => {
                      setActiveFilter(e.target.value as ActiveFilter);
                      resetToFirstPage();
                    }}
                    aria-label="Filter by status"
                    className={inputCls}
                  >
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>

                  <select
                    value={paidFilter}
                    onChange={(e) => {
                      setPaidFilter(e.target.value as PaidFilter);
                      resetToFirstPage();
                    }}
                    aria-label="Filter by paid"
                    className={inputCls}
                  >
                    <option value="all">Paid & unpaid</option>
                    <option value="paid">Paid only</option>
                    <option value="unpaid">Unpaid only</option>
                  </select>
                </div>
              </div>

              {filtered.length === 0 ? (
                <NoMatches onClear={clearFilters} />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {filtered.length} {filtered.length === 1 ? "leave type" : "leave types"}
                      {filtersDirty && ` (filtered from ${all.length})`}
                    </CardTitle>
                  </CardHeader>
                  <Table>
                    <THead>
                      <tr>
                        <SortHeader label="Name" col="name" sortKey={sortKey} sortOrder={sortOrder} onSort={toggleSort} />
                        <SortHeader label="Code" col="code" sortKey={sortKey} sortOrder={sortOrder} onSort={toggleSort} />
                        <TH>Paid</TH>
                        <TH>Status</TH>
                        <SortHeader label="Max / year" col="maxPerYear" sortKey={sortKey} sortOrder={sortOrder} onSort={toggleSort} />
                        <TH className="text-right">Actions</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {pageRows.map((t) => (
                        <TR key={t.id}>
                          <TD className="font-medium text-gray-900">{t.name}</TD>
                          <TD className="font-mono text-xs text-gray-600">{t.code}</TD>
                          <TD>
                            <PaidBadge isPaid={t.isPaid} />
                          </TD>
                          <TD>
                            <div className="flex items-center gap-2">
                              <Toggle
                                checked={t.isActive}
                                onChange={() => handleToggleActive(t)}
                                disabled={busyId === t.id}
                                label={`${t.isActive ? "Deactivate" : "Activate"} ${t.name}`}
                              />
                              <StatusBadge isActive={t.isActive} />
                            </div>
                          </TD>
                          <TD className="text-gray-600">{t.maxPerYear}</TD>
                          <TD className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEdit(t)}
                                aria-label={`Edit ${t.name}`}
                                className="rounded p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(t)}
                                disabled={busyId === t.id}
                                aria-label={`Delete ${t.name}`}
                                className="rounded p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/10 disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>

                  {/* Pagination — only when it earns its place. */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
                      <span>
                        Page {safePage} of {totalPages}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={safePage <= 1}
                          className="rounded border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-40"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safePage >= totalPages}
                          className="rounded border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </>
          )}
        </>
      )}

      <LeaveTypeFormModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}

function SortHeader({
  label,
  col,
  sortKey,
  sortOrder,
  onSort,
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortOrder: SortOrder;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <TH>
      <button
        type="button"
        onClick={() => onSort(col)}
        aria-label={`Sort by ${label}`}
        className="inline-flex items-center gap-1 font-medium text-gray-500 transition hover:text-gray-900 focus:outline-none"
      >
        {label}
        {active &&
          (sortOrder === "asc" ? (
            <ArrowUp className="size-3" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-3" aria-hidden="true" />
          ))}
      </button>
    </TH>
  );
}
