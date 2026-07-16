"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Branch Admin — Portfolio Requests (filter toolbar)
//
// STATE LIVES IN THE URL, so a filtered queue is shareable, survives a refresh and
// the back button works — and the page stays a Server Component that fetches once.
// Every control maps 1:1 to a query param GET /api/v1/admin/portfolio-requests
// actually reads: search, status, type. Nothing here the route can't answer.
// ============================================================================

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, X, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, TYPE_LABELS, type PortfolioRequestStatus, type PortfolioRequestType } from "@/components/worker-portfolio/request-types";

const SEARCH_DEBOUNCE_MS = 300;

const inputCls =
  "h-9 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-700 " +
  "outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5";

const STATUS_KEYS = Object.keys(STATUS_CONFIG) as PortfolioRequestStatus[];
const TYPE_KEYS = Object.keys(TYPE_LABELS) as PortfolioRequestType[];

export function RequestsToolbar() {
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

  const hasAnything =
    Boolean(searchParams.get("search")) || Boolean(searchParams.get("status")) || Boolean(searchParams.get("type"));

  return (
    <div className={cn("flex flex-wrap items-center gap-2 transition-opacity", isPending && "opacity-60")}>
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search worker or employee code…"
          aria-label="Search portfolio requests"
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

      <select
        aria-label="Filter by status"
        value={searchParams.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
        className={inputCls}
      >
        <option value="">All statuses</option>
        {STATUS_KEYS.map((s) => (
          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
        ))}
      </select>

      <select
        aria-label="Filter by request type"
        value={searchParams.get("type") ?? ""}
        onChange={(e) => setParam("type", e.target.value)}
        className={inputCls}
      >
        <option value="">All types</option>
        {TYPE_KEYS.map((t) => (
          <option key={t} value={t}>{TYPE_LABELS[t]}</option>
        ))}
      </select>

      {hasAnything && (
        <button
          type="button"
          onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
          className="inline-flex h-9 items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        >
          <RotateCw className="size-3.5" aria-hidden="true" />
          Reset
        </button>
      )}
    </div>
  );
}
