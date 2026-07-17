"use client";

// OWNER: Gauransh
// MODULE: Membership Management (plan detail drawer)
// FLOW  : Open a plan → show Basic Information + Benefits (from the already-loaded
//         row), Statistics (GET /admin/memberships/plans/[id] → additive `stats`),
//         and the subscriber list (GET .../plans/[id]/customers, BACKEND search +
//         status filter + pagination). Each customer row's menu only NAVIGATES to the
//         existing customer module — no duplicate pages, no client-side filtering.
// ACCESS: SUPER_ADMIN (page-guarded); endpoints re-check SUPER_ADMIN/OWNER.

import * as React from "react";
import { useRouter } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import { X, Search, MoreVertical, User, History, CalendarDays, Receipt, UserRound } from "lucide-react";
import { Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { TableSkeleton } from "@/components/dashboard/loading-skeleton";
import { EmptyState } from "@/components/dashboard/empty-state";
import { API } from "@/lib/endpoints";
import { cn } from "@/lib/utils";
import {
  STATUS_TONE, TIER_TONE, money, customerName, formatDate, remainingDays,
  type ApiEnvelope, type MemberRow, type Paginated, type PlanRow, type PlanStats,
} from "./types";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;
const inputCls = "h-9 w-full rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-700 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5";
const menuItemCls = "flex w-full cursor-default items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 outline-none transition select-none data-[highlighted]:bg-gray-50 data-[highlighted]:text-gray-900";

export function PlanCustomersDrawer({ plan, onClose }: { plan: PlanRow | null; onClose: () => void }) {
  const router = useRouter();
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const open = plan !== null;
  const planId = plan?.id ?? null;

  const [stats, setStats] = React.useState<PlanStats | null>(null);
  const [rows, setRows] = React.useState<MemberRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(0);
  const [term, setTerm] = React.useState("");
  const [committedSearch, setCommittedSearch] = React.useState("");
  const [status, setStatus] = React.useState("");

  // Reset per-plan state each time a new plan opens the drawer.
  const [shownId, setShownId] = React.useState<string | null>(null);
  if (open && planId !== shownId) {
    setShownId(planId); setTerm(""); setCommittedSearch(""); setStatus(""); setPage(1); setStats(null);
  } else if (!open && shownId !== null) {
    setShownId(null);
  }

  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Statistics — one fetch per opened plan (GET /plans/[id] → stats block).
  React.useEffect(() => {
    if (!open || !planId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(API.admin.membershipPlan(planId));
        const json = (await res.json()) as ApiEnvelope<{ stats: PlanStats }>;
        if (!cancelled && res.ok && json.success && json.data) setStats(json.data.stats);
      } catch {
        /* stats section shows dashes on a transient failure */
      }
    })();
    return () => { cancelled = true; };
  }, [open, planId]);

  // Debounced backend search (one request per pause; reset to page 1).
  React.useEffect(() => {
    if (term === committedSearch) return;
    const t = setTimeout(() => { setCommittedSearch(term); setPage(1); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term, committedSearch]);

  // Subscriber page — aborts the in-flight request so rapid changes can't race/dupe.
  const abortRef = React.useRef<AbortController | null>(null);
  React.useEffect(() => {
    if (!open || !planId) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    void (async () => {
      setLoading(true);
      setError(null);
      setNow(Date.now()); // stable clock for "remaining days" this fetch
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (committedSearch.trim()) params.set("search", committedSearch.trim());
      if (status) params.set("status", status);
      try {
        const res = await fetch(`${API.admin.membershipPlanCustomers(planId)}?${params.toString()}`, { signal: ac.signal });
        const json = (await res.json()) as ApiEnvelope<Paginated<MemberRow>>;
        if (res.ok && json.success && json.data) {
          setRows(json.data.items); setTotal(json.data.total); setTotalPages(json.data.totalPages);
        } else {
          setError(json.message || "Could not load customers"); setRows([]);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("Could not reach the server."); setRows([]);
      } finally {
        if (abortRef.current === ac) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [open, planId, page, committedSearch, status]);

  const goToCustomer = (customerId: string) => { onClose(); router.push(`/super-admin/customers/${customerId}`); };

  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
      aria-labelledby="plan-detail-title"
      className="ml-auto h-dvh w-[calc(100vw-2rem)] max-w-3xl rounded-none border-l border-gray-200 bg-white p-0 shadow-xl backdrop:bg-gray-900/40"
    >
      {plan && (
        <div className="flex h-dvh flex-col">
          <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
            <div className="min-w-0">
              <h2 id="plan-detail-title" className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                {plan.name} <Badge tone={TIER_TONE[plan.tier]}>{plan.tier}</Badge>
                <Badge tone={plan.isActive ? "success" : "neutral"}>{plan.isActive ? "Active" : "Inactive"}</Badge>
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">{total} subscriber{total === 1 ? "" : "s"} · {plan.activeMembers} active</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/10"><X className="size-4" /></button>
          </div>

          <div className="flex-1 overflow-auto">
            {/* ── Basic Information (from the already-loaded row) ─────────────── */}
            <Section title="Basic information">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-3">
                <Detail label="Name" value={plan.name} />
                <Detail label="Tier" value={plan.tier} />
                <Detail label="Price" value={money(plan.price)} />
                <Detail label="Validity" value={`${plan.validityDays} days`} />
                <Detail label="Discount" value={`${plan.discountPercent}%`} />
                <Detail label="Wallet credit" value={money(plan.walletCredit)} />
                <Detail label="Branch access" value={plan.branchAccess === "ALL" ? "All branches" : plan.branchAccess} />
                <Detail label="Priority booking" value={plan.priorityBooking ? "Yes" : "No"} />
                <Detail label="Description" value={plan.description || "—"} />
              </dl>
            </Section>

            {/* ── Benefits ───────────────────────────────────────────────────── */}
            <Section title="Benefits">
              {plan.benefits.length === 0 ? (
                <p className="text-xs text-gray-400">No benefits configured.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {plan.benefits.map((b) => (
                    <li key={b.id} className="rounded border border-gray-100 bg-gray-50/60 px-2.5 py-1 text-xs text-gray-700">
                      {b.name}{b.value ? <span className="text-gray-400"> · {b.value}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* ── Statistics (GET /plans/[id] stats) ─────────────────────────── */}
            <Section title="Statistics">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Total members" value={stats ? String(stats.total) : "—"} />
                <Stat label="Active" value={stats ? String(stats.active) : "—"} />
                <Stat label="Frozen" value={stats ? String(stats.frozen) : "—"} />
                <Stat label="Expired" value={stats ? String(stats.expired) : "—"} />
                <Stat label="Cancelled" value={stats ? String(stats.cancelled) : "—"} />
                <Stat label="Revenue" value={stats ? money(stats.revenue) : "—"} />
                <Stat label="Renewals due" value={stats ? String(stats.renewalsDue) : "—"} />
                <Stat label="Latest purchase" value={stats ? formatDate(stats.latestPurchase) : "—"} />
              </div>
            </Section>

            {/* ── Customers ──────────────────────────────────────────────────── */}
            <div className="border-t border-gray-100 px-5 py-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Customers</h3>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="relative min-w-0 flex-1 sm:max-w-xs">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                  <input type="search" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search name, phone or email…" aria-label="Search customers" className={cn(inputCls, "pl-8 pr-8")} />
                  {term && <button type="button" onClick={() => setTerm("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"><X className="size-3.5" /></button>}
                </div>
                <select aria-label="Filter by membership status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={inputCls}>
                  <option value="">All statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="FROZEN">Frozen</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {loading ? (
                <TableSkeleton rows={PAGE_SIZE} cols={7} />
              ) : error ? (
                <div className="px-6 py-10 text-center"><p className="text-sm font-semibold text-gray-900">Could not load customers</p><p className="mt-1 text-xs text-gray-500">{error}</p></div>
              ) : rows.length === 0 ? (
                <EmptyState icon={UserRound} title={committedSearch || status ? "No customers match" : "No customers on this plan yet"} />
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <TH>Customer</TH><TH>Phone</TH><TH>Status</TH><TH>Start</TH><TH>End</TH>
                      <TH className="text-right">Remaining</TH><TH>Auto renew</TH><TH className="text-right">Actions</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {rows.map((m) => (
                      <TR key={m.id}>
                        <TD className="font-medium text-gray-900">{customerName(m.customer)}</TD>
                        <TD className="text-xs text-gray-500">{m.customer.phone ?? "—"}</TD>
                        <TD><Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge></TD>
                        <TD className="whitespace-nowrap text-xs text-gray-500">{formatDate(m.startDate)}</TD>
                        <TD className="whitespace-nowrap text-xs text-gray-500">{formatDate(m.endDate)}</TD>
                        <TD className="text-right text-xs text-gray-600">{m.status === "ACTIVE" ? `${remainingDays(m.endDate, now)}d` : "—"}</TD>
                        <TD>{m.autoRenew ? <Badge tone="info">On</Badge> : <span className="text-xs text-gray-300">Off</span>}</TD>
                        <TD className="text-right">
                          <Menu.Root>
                            <Menu.Trigger aria-label="Customer actions" className="inline-flex size-8 items-center justify-center rounded text-gray-400 outline-none transition hover:bg-gray-100 hover:text-gray-700 focus-visible:ring-2 focus-visible:ring-gray-900/10 data-[popup-open]:bg-gray-100"><MoreVertical className="size-4" /></Menu.Trigger>
                            <Menu.Portal>
                              <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-50">
                                <Menu.Popup className="min-w-44 rounded-md border border-gray-200 bg-white py-1 shadow-sm outline-none">
                                  <Menu.Item className={menuItemCls} onClick={() => goToCustomer(m.customer.id)}><User className="size-3.5 text-gray-400" aria-hidden="true" /> View customer</Menu.Item>
                                  <Menu.Item className={menuItemCls} onClick={() => goToCustomer(m.customer.id)}><History className="size-3.5 text-gray-400" aria-hidden="true" /> Membership history</Menu.Item>
                                  <Menu.Item className={menuItemCls} onClick={() => goToCustomer(m.customer.id)}><CalendarDays className="size-3.5 text-gray-400" aria-hidden="true" /> Appointments</Menu.Item>
                                  <Menu.Item className={menuItemCls} onClick={() => goToCustomer(m.customer.id)}><Receipt className="size-3.5 text-gray-400" aria-hidden="true" /> Invoice history</Menu.Item>
                                </Menu.Popup>
                              </Menu.Positioner>
                            </Menu.Portal>
                          </Menu.Root>
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}

              {!loading && !error && rows.length > 0 && totalPages > 1 && (
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span>{from}–{to} of {total}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 disabled:opacity-40">Previous</button>
                    <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded border border-gray-200 px-2.5 py-1 transition hover:bg-gray-50 disabled:opacity-40">Next</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-100 px-5 py-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{title}</h3>
      {children}
    </div>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-gray-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-gray-800">{value}</dd>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-100 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
