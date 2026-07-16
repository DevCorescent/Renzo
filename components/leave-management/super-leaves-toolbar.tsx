"use client";

// OWNER: Gauransh
// MODULE: Super Admin Leave Management

// ============================================================================
// URL-as-state filter toolbar (shareable, refresh-safe, back-button-friendly). Every
// control maps 1:1 to a query param GET /api/v1/admin/leaves actually reads —
// search, branchId, status, leaveTypeId, from, to, sortOrder — so no control is a
// no-op. The Branch filter is the Super-Admin-only addition; the API treats a
// global caller's ?branchId as a narrowing filter (and ignores it for branch roles).
// ============================================================================

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaveTypeOption } from "@/components/branch-leaves/types";

export type BranchOption = { id: string; name: string };

const SEARCH_DEBOUNCE_MS = 300;
const inputCls =
  "h-9 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-700 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5";

export function SuperLeavesToolbar({
  leaveTypes,
  branches,
}: {
  leaveTypes: LeaveTypeOption[];
  branches: BranchOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isPending, startTransition] = React.useTransition();
  const [term, setTerm] = React.useState(searchParams.get("search") ?? "");

  // Every mutation resets the page number — a narrowed result set invalidates it.
  const commit = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("page");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
    },
    [router, pathname, searchParams]
  );

  // Debounced search — one navigation per pause, not per keystroke.
  React.useEffect(() => {
    if (term === (searchParams.get("search") ?? "")) return;
    const timer = setTimeout(() => {
      commit((params) => {
        if (term) params.set("search", term);
        else params.delete("search");
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, searchParams, commit]);

  const setParam = (key: string, value: string) =>
    commit((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });

  const hasAnything = [...searchParams.keys()].some((k) => k !== "page");

  return (
    <div className={cn("flex flex-wrap items-center gap-2 transition-opacity", isPending && "opacity-60")}>
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search employee or code…"
          aria-label="Search leave requests"
          className={cn(inputCls, "w-full pl-8 pr-8")}
        />
        {term && (
          <button type="button" onClick={() => setTerm("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {branches.length > 0 && (
        <select aria-label="Filter by branch" value={searchParams.get("branchId") ?? ""} onChange={(e) => setParam("branchId", e.target.value)} className={inputCls}>
          <option value="">All branches</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}

      <select aria-label="Filter by status" value={searchParams.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value)} className={inputCls}>
        <option value="">All statuses</option>
        <option value="PENDING">Pending</option>
        <option value="APPROVED">Approved</option>
        <option value="REJECTED">Rejected</option>
        <option value="CANCELLED">Cancelled</option>
      </select>

      {leaveTypes.length > 0 && (
        <select aria-label="Filter by leave type" value={searchParams.get("leaveTypeId") ?? ""} onChange={(e) => setParam("leaveTypeId", e.target.value)} className={inputCls}>
          <option value="">All leave types</option>
          {leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}
        </select>
      )}

      <label className="flex items-center gap-1 text-xs text-gray-500">
        <span className="sr-only sm:not-sr-only">From</span>
        <input type="date" aria-label="From date" value={searchParams.get("from") ?? ""} onChange={(e) => setParam("from", e.target.value)} className={inputCls} />
      </label>
      <label className="flex items-center gap-1 text-xs text-gray-500">
        <span className="sr-only sm:not-sr-only">To</span>
        <input type="date" aria-label="To date" value={searchParams.get("to") ?? ""} onChange={(e) => setParam("to", e.target.value)} className={inputCls} />
      </label>

      <select aria-label="Sort order" value={searchParams.get("sortOrder") ?? "desc"} onChange={(e) => setParam("sortOrder", e.target.value === "asc" ? "asc" : "")} className={inputCls}>
        <option value="desc">Newest first</option>
        <option value="asc">Oldest first</option>
      </select>

      {hasAnything && (
        <button type="button" onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))} className="inline-flex h-9 items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10">
          <RotateCw className="size-3.5" aria-hidden="true" /> Reset
        </button>
      )}
    </div>
  );
}
