"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Inventory (UI) — filter toolbar
//
// STATE LIVES IN THE URL, so a filtered inventory view is shareable, survives a
// refresh and the back button works — and the page stays a Server Component that
// fetches once. Every control maps 1:1 to a query param the stock API reads:
// search, categoryId, supplierId, status, flag, sortBy, sortOrder, branchId.
//
// The Branch filter is shown ONLY to Super Admin. A Branch Admin cannot narrow to
// another branch anyway — the API pins them to their session branch — so exposing
// the control would be misleading.
// ============================================================================

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Option } from "./types";

const SEARCH_DEBOUNCE_MS = 300;
const inputCls =
  "h-9 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-700 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text)] dark:focus:ring-white/10";

export function InventoryToolbar({
  categories,
  suppliers,
  branches,
}: {
  categories: Option[];
  suppliers: Option[];
  /** Empty for Branch Admin → the Branch filter is hidden. */
  branches: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isPending, startTransition] = React.useTransition();
  const [term, setTerm] = React.useState(searchParams.get("search") ?? "");

  const commit = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("page"); // any filter change invalidates the page number
      startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
    },
    [router, pathname, searchParams]
  );

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
          placeholder="Search name or SKU…"
          aria-label="Search inventory"
          className={cn(inputCls, "w-full pl-8 pr-8")}
        />
        {term && (
          <button type="button" onClick={() => setTerm("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <select aria-label="Filter by category" value={searchParams.get("categoryId") ?? ""} onChange={(e) => setParam("categoryId", e.target.value)} className={inputCls}>
        <option value="">All categories</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <select aria-label="Filter by supplier" value={searchParams.get("supplierId") ?? ""} onChange={(e) => setParam("supplierId", e.target.value)} className={inputCls}>
        <option value="">All suppliers</option>
        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      {branches.length > 0 && (
        <select aria-label="Filter by branch" value={searchParams.get("branchId") ?? ""} onChange={(e) => setParam("branchId", e.target.value)} className={inputCls}>
          <option value="">All branches</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      )}

      <select aria-label="Filter by status" value={searchParams.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value)} className={inputCls}>
        <option value="">All stock</option>
        <option value="low">Low stock</option>
        <option value="out">Out of stock</option>
      </select>

      <select aria-label="Filter by type" value={searchParams.get("flag") ?? ""} onChange={(e) => setParam("flag", e.target.value)} className={inputCls}>
        <option value="">Any type</option>
        <option value="retail">Retail</option>
        <option value="consumable">Consumable</option>
        <option value="active">Active only</option>
      </select>

      <select aria-label="Sort by" value={searchParams.get("sortBy") ?? "updated"} onChange={(e) => setParam("sortBy", e.target.value === "updated" ? "" : e.target.value)} className={inputCls}>
        <option value="updated">Recently updated</option>
        <option value="stock">Stock level</option>
        <option value="name">Name</option>
        <option value="category">Category</option>
      </select>

      {hasAnything && (
        <button
          type="button"
          onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
          className="inline-flex h-9 items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text-2)] dark:hover:bg-[var(--sa-hover)]"
        >
          <RotateCw className="size-3.5" aria-hidden="true" /> Reset
        </button>
      )}
    </div>
  );
}
