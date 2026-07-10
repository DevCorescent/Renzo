"use client";

// Reusable enterprise table: client-side search + sort, sticky header, hover,
// optional clickable rows, and an empty state. Purely presentational — data is
// passed in already-fetched, so it never touches the API layer.
import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

export type Column<T> = {
  key: string;
  header: string;
  /** Cell renderer. */
  cell: (row: T) => React.ReactNode;
  /** Value used for sorting / searching (string or number). */
  sortValue?: (row: T) => string | number;
  align?: "left" | "right" | "center";
  className?: string;
  sortable?: boolean;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  getRowHref,
  searchable = true,
  searchPlaceholder = "Search…",
  searchKeys,
  empty,
  initialSort,
  pageSize,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  getRowHref?: (row: T) => string | undefined;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (row: T) => string;
  empty?: { title: string; description?: string; action?: React.ReactNode };
  initialSort?: { key: string; dir: "asc" | "desc" };
  pageSize?: number;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<{ key: string; dir: "asc" | "desc" } | null>(initialSort ?? null);
  const [page, setPage] = React.useState(0);

  const filtered = React.useMemo(() => {
    let out = rows;
    const q = query.trim().toLowerCase();
    if (q && searchable) {
      out = out.filter((r) => {
        const hay = searchKeys
          ? searchKeys(r)
          : columns.map((c) => c.sortValue?.(r) ?? "").join(" ");
        return String(hay).toLowerCase().includes(q);
      });
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        out = [...out].sort((a, b) => {
          const av = col.sortValue!(a);
          const bv = col.sortValue!(b);
          const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }
    return out;
  }, [rows, query, sort, columns, searchable, searchKeys]);

  const pages = pageSize ? Math.max(1, Math.ceil(filtered.length / pageSize)) : 1;
  const clampedPage = Math.min(page, pages - 1);
  const visible = pageSize ? filtered.slice(clampedPage * pageSize, clampedPage * pageSize + pageSize) : filtered;

  function onSearch(value: string) {
    setQuery(value);
    setPage(0);
  }

  function toggleSort(key: string) {
    setPage(0);
    setSort((s) => {
      if (s?.key !== key) return { key, dir: "asc" };
      if (s.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  return (
    <div className="flex flex-col">
      {searchable && (
        <div className="flex items-center gap-3 px-5 py-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-(--sa-muted)" />
            <input
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50/60 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus:border-amber-300 focus:bg-white focus:ring-2 focus:ring-amber-100 dark:border-(--sa-border) dark:bg-(--sa-tile) dark:text-(--sa-text) dark:placeholder:text-(--sa-muted) dark:focus:border-amber-500/40 dark:focus:bg-(--sa-surface) dark:focus:ring-amber-500/20"
            />
          </div>
          <span className="ml-auto text-xs text-gray-400 dark:text-(--sa-muted)">
            {filtered.length} {filtered.length === 1 ? "result" : "results"}
          </span>
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur dark:bg-(--sa-surface-2)">
            <tr className="border-y border-gray-100 text-left dark:border-(--sa-border)">
              {columns.map((c) => {
                const sorted = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    className={cn(
                      "px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-(--sa-text-2)",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.className
                    )}
                  >
                    {c.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded transition-colors hover:text-gray-900 dark:hover:text-(--sa-text)",
                          c.align === "right" && "flex-row-reverse",
                          sorted && "text-gray-900 dark:text-(--sa-text)"
                        )}
                      >
                        {c.header}
                        {sorted ? (
                          sort!.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
                        ) : (
                          <ChevronsUpDown className="size-3 text-gray-300 dark:text-(--sa-muted)" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={empty?.title ?? "No results"} description={empty?.description} action={empty?.action} />
                </td>
              </tr>
            ) : (
              visible.map((row) => {
                const href = getRowHref?.(row);
                return (
                  <tr
                    key={getRowKey(row)}
                    onClick={href ? () => router.push(href) : undefined}
                    className={cn(
                      "border-b border-gray-50 transition-colors last:border-0 dark:border-(--sa-border)",
                      href ? "cursor-pointer hover:bg-amber-50/40 dark:hover:bg-amber-500/5" : "hover:bg-gray-50/70 dark:hover:bg-white/5"
                    )}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-5 py-3.5 align-middle text-gray-700 dark:text-(--sa-text-2)",
                          c.align === "right" && "text-right",
                          c.align === "center" && "text-center",
                          c.className
                        )}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pageSize && filtered.length > pageSize && (
        <div className="flex items-center justify-between px-5 py-3 text-xs text-gray-500 dark:text-(--sa-text-2)">
          <span>
            Page {clampedPage + 1} of {pages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={clampedPage === 0}
              className="rounded-md border border-gray-200 px-2.5 py-1 font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover)"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={clampedPage >= pages - 1}
              className="rounded-md border border-gray-200 px-2.5 py-1 font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-40 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover)"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
