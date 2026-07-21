"use client";

// Filter bar for the workers list.
//
// STATE LIVES IN THE URL. A filtered view is then shareable, bookmarkable,
// survives a refresh, and the back button works — none of which a client cache
// gives you for free. It also keeps the page a Server Component, so the data is
// fetched once, on the server, with no client-side waterfall.
//
// EVERY CONTROL HERE MAPS 1:1 TO A QUERY PARAM GET /api/v1/admin/workers ACTUALLY
// READS. The route supports isActive, isPublic, gender, departmentId,
// designationId, sortBy and sortOrder — and nothing else.

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Only the four keys the route whitelists. Anything else is rejected there anyway. */
const FILTER_KEYS = ["isActive", "gender", "designationId", "departmentId"] as const;

type Option = { value: string; label: string };

const inputCls =
  "h-9 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-700 " +
  "outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-900/5 " +
  "dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text)] dark:focus:ring-white/10";

export function WorkersToolbar({
  designations = [],
  departments = [],
}: {
  /**
   * Empty for a Branch Admin: GET /admin/designations and /admin/departments are
   * SUPER_ADMIN/OWNER only, so a branch admin has no API to populate them from.
   * The selects are hidden rather than rendered empty.
   */
  designations?: Option[];
  departments?: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [isPending, startTransition] = React.useTransition();

  const commit = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete("page");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams]
  );

  const setParam = (key: string, value: string) =>
    commit((params) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });

  const activeFilters = FILTER_KEYS.filter((k) => searchParams.get(k)).length;
  const hasAnything = activeFilters > 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 transition-opacity",
        isPending && "opacity-60"
      )}
    >
      <select
        aria-label="Filter by status"
        value={searchParams.get("isActive") ?? ""}
        onChange={(e) => setParam("isActive", e.target.value)}
        className={inputCls}
      >
        <option value="">Active &amp; inactive</option>
        <option value="true">Active only</option>
        <option value="false">Inactive only</option>
      </select>

      {/* The three values are exactly the Gender enum in the Prisma schema. */}
      <select
        aria-label="Filter by gender"
        value={searchParams.get("gender") ?? ""}
        onChange={(e) => setParam("gender", e.target.value)}
        className={inputCls}
      >
        <option value="">Any gender</option>
        <option value="MALE">Male</option>
        <option value="FEMALE">Female</option>
        <option value="UNISEX">Unisex</option>
      </select>

      {designations.length > 0 && (
        <select
          aria-label="Filter by designation"
          value={searchParams.get("designationId") ?? ""}
          onChange={(e) => setParam("designationId", e.target.value)}
          className={inputCls}
        >
          <option value="">All designations</option>
          {designations.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      )}

      {departments.length > 0 && (
        <select
          aria-label="Filter by department"
          value={searchParams.get("departmentId") ?? ""}
          onChange={(e) => setParam("departmentId", e.target.value)}
          className={inputCls}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      )}

      {hasAnything && (
        <button
          type="button"
          onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
          className="inline-flex h-9 items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 text-sm text-gray-600 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-[var(--sa-border)] dark:bg-[var(--sa-tile)] dark:text-[var(--sa-text-2)] dark:hover:bg-[var(--sa-hover)]"
        >
          <RotateCw className="size-3.5" aria-hidden="true" />
          Reset
          {activeFilters > 0 && (
            <span className="ml-0.5 rounded bg-gray-900 px-1 text-[10px] font-medium text-white">
              {activeFilters}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
