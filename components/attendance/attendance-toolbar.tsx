"use client";

// ============================================================================
// MODULE : Attendance — filter toolbar
//
// URL-as-state (shareable, refresh-safe, back-button-friendly), the same pattern
// as the leave module's toolbar. EVERY control maps 1:1 onto a query param that
// GET /api/v1/admin/attendance actually reads — search, branchId, workerId,
// shiftId, status, from, to, late, overtime, sortBy, sortOrder — so no control
// here is decorative.
//
// The Branch select is rendered only when the caller is global; the API ignores a
// branch-scoped role's ?branchId anyway, so showing it to a branch admin would be
// offering a filter that cannot do anything.
// ============================================================================

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_STATUSES,
  statusLabel,
  type BranchOption,
  type ShiftOption,
  type WorkerOption,
} from "@/components/attendance/types";

const SEARCH_DEBOUNCE_MS = 300;

const inputCls =
  "h-9 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-700 outline-none transition " +
  "focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 " +
  "dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)";

const toggleCls =
  "inline-flex h-9 items-center gap-1.5 rounded border px-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-gray-900/10";

export function AttendanceToolbar({
  branches,
  workers,
  shifts,
  showBranchFilter,
}: {
  branches: BranchOption[];
  workers: WorkerOption[];
  shifts: ShiftOption[];
  showBranchFilter: boolean;
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

  const toggleParam = (key: string) =>
    commit((params) => {
      if (params.get(key) === "true") params.delete(key);
      else params.set(key, "true");
    });

  const lateOn = searchParams.get("late") === "true";
  const overtimeOn = searchParams.get("overtime") === "true";
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
          aria-label="Search attendance"
          className={cn(inputCls, "w-full pl-8 pr-8")}
        />
        {term && (
          <button
            type="button"
            onClick={() => setTerm("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {showBranchFilter && branches.length > 0 && (
        <select
          aria-label="Filter by branch"
          value={searchParams.get("branchId") ?? ""}
          onChange={(e) => setParam("branchId", e.target.value)}
          className={inputCls}
        >
          <option value="">All branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      )}

      {workers.length > 0 && (
        <select
          aria-label="Filter by employee"
          value={searchParams.get("workerId") ?? ""}
          onChange={(e) => setParam("workerId", e.target.value)}
          className={inputCls}
        >
          <option value="">All employees</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>{w.name} ({w.employeeCode})</option>
          ))}
        </select>
      )}

      <select
        aria-label="Filter by status"
        value={searchParams.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
        className={inputCls}
      >
        <option value="">All statuses</option>
        {ATTENDANCE_STATUSES.map((s) => (
          <option key={s} value={s}>{statusLabel(s)}</option>
        ))}
      </select>

      {shifts.length > 0 && (
        <select
          aria-label="Filter by shift"
          value={searchParams.get("shiftId") ?? ""}
          onChange={(e) => setParam("shiftId", e.target.value)}
          className={inputCls}
        >
          <option value="">All shifts</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}

      <select
        aria-label="Filter by entry type"
        value={searchParams.get("entryType") ?? ""}
        onChange={(e) => setParam("entryType", e.target.value)}
        className={inputCls}
      >
        <option value="">All entries</option>
        <option value="automatic">Automatic only</option>
        <option value="manual">Manual only</option>
      </select>

      <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-(--sa-text-2)">
        <span className="sr-only sm:not-sr-only">From</span>
        <input
          type="date"
          aria-label="From date"
          value={searchParams.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value)}
          className={inputCls}
        />
      </label>
      <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-(--sa-text-2)">
        <span className="sr-only sm:not-sr-only">To</span>
        <input
          type="date"
          aria-label="To date"
          value={searchParams.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value)}
          className={inputCls}
        />
      </label>

      <button
        type="button"
        aria-pressed={lateOn}
        onClick={() => toggleParam("late")}
        className={cn(
          toggleCls,
          lateOn
            ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300"
            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)"
        )}
      >
        Late only
      </button>

      <button
        type="button"
        aria-pressed={overtimeOn}
        onClick={() => toggleParam("overtime")}
        className={cn(
          toggleCls,
          overtimeOn
            ? "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300"
            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)"
        )}
      >
        Overtime only
      </button>

      <select
        aria-label="Sort by"
        value={searchParams.get("sortBy") ?? "date"}
        onChange={(e) => setParam("sortBy", e.target.value === "date" ? "" : e.target.value)}
        className={inputCls}
      >
        <option value="date">Sort: Date</option>
        <option value="workingMinutes">Sort: Working hours</option>
        <option value="lateMinutes">Sort: Late minutes</option>
        <option value="overtimeMinutes">Sort: Overtime</option>
        <option value="checkIn">Sort: Check in</option>
        <option value="status">Sort: Status</option>
      </select>

      <select
        aria-label="Sort order"
        value={searchParams.get("sortOrder") ?? "desc"}
        onChange={(e) => setParam("sortOrder", e.target.value === "asc" ? "asc" : "")}
        className={inputCls}
      >
        <option value="desc">Newest first</option>
        <option value="asc">Oldest first</option>
      </select>

      {hasAnything && (
        <button
          type="button"
          onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
          className="inline-flex h-9 items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text-2)"
        >
          <RotateCw className="size-3.5" aria-hidden="true" /> Reset
        </button>
      )}
    </div>
  );
}
