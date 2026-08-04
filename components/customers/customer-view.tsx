"use client";

// ============================================================================
// MODULE : Customers — table, filters and actions
//
// One client component serving Super Admin, Owner, Branch Admin and Reception.
// What differs between them is the CAPABILITY object handed down from the page,
// which is resolved on the server from the signed-in role — so the buttons a role
// sees can never drift from what the API will actually permit.
//
// Filters live in the URL (?search=&customerType=…), so the browser Back button
// works, a filtered view is shareable, and the export button can simply forward
// the same query string it is looking at.
// ============================================================================

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  UserPlus,
  Pencil,
  Trash2,
  FileDown,
  FileSpreadsheet,
  FileText,
  Upload,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, Card, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import {
  NewCustomerDialog,
  EditCustomerDialog,
  DeleteCustomerDialog,
  ImportCustomersDialog,
} from "@/components/customers/customer-dialogs";
import {
  CUSTOMER_SOURCES,
  CUSTOMER_TYPES,
  formatCurrency,
  formatDate,
  labelise,
  type BranchOption,
  type CustomerCapability,
  type CustomerRow,
} from "@/components/customers/types";

const inputCls =
  "h-8 rounded border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text) dark:focus:border-white/30";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-white/5";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-white/90";

/** Tone per customer type — VIP and Membership should stand out in a long list. */
const TYPE_TONE = {
  WALK_IN: "neutral",
  RETURNING: "info",
  VIP: "warning",
  MEMBERSHIP: "success",
} as const;

export function CustomerView({
  rows,
  total,
  page,
  totalPages,
  branches,
  capability,
  endpoint,
  exportEndpoint,
  importEndpoint,
  profileBasePath,
  bookingPath,
}: {
  rows: CustomerRow[];
  total: number;
  page: number;
  totalPages: number;
  branches: BranchOption[];
  capability: CustomerCapability;
  /** Collection URL; per-customer URLs are derived as `${endpoint}/${id}`. */
  endpoint: string;
  exportEndpoint: string;
  importEndpoint: string;
  profileBasePath: string;
  bookingPath: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();

  const [creating, setCreating] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [editing, setEditing] = React.useState<CustomerRow | null>(null);
  const [deleting, setDeleting] = React.useState<CustomerRow | null>(null);

  // Local mirror so the search box stays responsive while the debounce settles.
  const urlSearch = searchParams.get("search") ?? "";
  const [search, setSearch] = React.useState(urlSearch);
  const [lastUrlSearch, setLastUrlSearch] = React.useState(urlSearch);
  if (urlSearch !== lastUrlSearch) {
    // The URL changed underneath us (Back button, a filter reset) — follow it.
    setLastUrlSearch(urlSearch);
    setSearch(urlSearch);
  }

  const setParam = React.useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      // Any filter change invalidates the page cursor.
      next.delete("page");
      startTransition(() => router.replace(`${pathname}?${next.toString()}`));
    },
    [pathname, router, searchParams]
  );

  // Debounced: typing a 10-digit phone should not fire ten queries.
  React.useEffect(() => {
    if (search === urlSearch) return;
    const timer = setTimeout(() => setParam("search", search), 350);
    return () => clearTimeout(timer);
  }, [search, urlSearch, setParam]);

  const exportHref = (format: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", format);
    params.delete("page");
    return `${exportEndpoint}?${params.toString()}`;
  };

  const goToPage = (next: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(next));
    startTransition(() => router.replace(`${pathname}?${params.toString()}`));
  };

  return (
    <div className="space-y-4">
      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-gray-400 dark:text-(--sa-muted)"
            aria-hidden="true"
          />
          <input
            aria-label="Search customers"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone or email…"
            className={cn(inputCls, "w-full pl-7")}
          />
        </div>

        <select
          aria-label="Filter by customer type"
          value={searchParams.get("customerType") ?? ""}
          onChange={(e) => setParam("customerType", e.target.value)}
          className={inputCls}
        >
          <option value="">All types</option>
          {CUSTOMER_TYPES.map((t) => (
            <option key={t} value={t}>{labelise(t)}</option>
          ))}
        </select>

        <select
          aria-label="Filter by source"
          value={searchParams.get("entrySource") ?? ""}
          onChange={(e) => setParam("entrySource", e.target.value)}
          className={inputCls}
        >
          <option value="">All sources</option>
          {CUSTOMER_SOURCES.map((s) => (
            <option key={s} value={s}>{labelise(s)}</option>
          ))}
        </select>

        <select
          aria-label="Filter by entry type"
          value={searchParams.get("entryType") ?? ""}
          onChange={(e) => setParam("entryType", e.target.value)}
          className={inputCls}
        >
          <option value="">All entries</option>
          <option value="manual">Manual only</option>
          <option value="registered">Self-registered</option>
        </select>

        <button
          type="button"
          aria-pressed={searchParams.get("membership") === "true"}
          onClick={() =>
            setParam("membership", searchParams.get("membership") === "true" ? "" : "true")
          }
          className={cn(
            btnGhost,
            searchParams.get("membership") === "true" &&
              "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300"
          )}
        >
          Members
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {capability.canImportExport && (
            <>
              <a href={exportHref("csv")} className={btnGhost}>
                <FileDown className="size-3.5" aria-hidden="true" /> CSV
              </a>
              <a href={exportHref("excel")} className={btnGhost}>
                <FileSpreadsheet className="size-3.5" aria-hidden="true" /> Excel
              </a>
              <a href={exportHref("pdf")} className={btnGhost}>
                <FileText className="size-3.5" aria-hidden="true" /> PDF
              </a>
              <button type="button" onClick={() => setImporting(true)} className={btnGhost}>
                <Upload className="size-3.5" aria-hidden="true" /> Import
              </button>
            </>
          )}
          {capability.canCreate && (
            <button type="button" onClick={() => setCreating(true)} className={btnPrimary}>
              <UserPlus className="size-3.5" aria-hidden="true" />
              New walk-in customer
            </button>
          )}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <Card className={cn("transition-opacity", isPending && "opacity-60")}>
        <Table>
          <THead>
            <tr>
              <TH>Customer</TH>
              <TH>Contact</TH>
              <TH>City</TH>
              <TH>Branch</TH>
              <TH>Type</TH>
              <TH>Source</TH>
              <TH>Entry</TH>
              <TH>Membership</TH>
              <TH>Visits</TH>
              <TH>Spend</TH>
              <TH>Added</TH>
              {(capability.canEdit || capability.canDelete) && <TH>Actions</TH>}
            </tr>
          </THead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={capability.canEdit || capability.canDelete ? 12 : 11}>
                  <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
                    <Users className="size-6 text-gray-300 dark:text-(--sa-muted)" aria-hidden="true" />
                    <p className="text-sm text-gray-500 dark:text-(--sa-text-2)">No customers found</p>
                    <p className="text-xs text-gray-400 dark:text-(--sa-muted)">
                      Nothing matches these filters. Add a walk-in to get started.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const membership = row.memberships[0];
                return (
                  <TR key={row.id} className={cn(row.deletedAt && "opacity-50")}>
                    <TD>
                      <Link
                        href={`${profileBasePath}/${row.id}`}
                        className="block text-sm text-gray-800 hover:underline dark:text-(--sa-text)"
                      >
                        {`${row.firstName} ${row.lastName ?? ""}`.trim()}
                      </Link>
                      {row.deletedAt && (
                        <span className="text-[11px] text-red-500 dark:text-red-400">Deleted</span>
                      )}
                    </TD>

                    <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">
                      {row.phone && <span className="block font-mono">{row.phone}</span>}
                      {row.email && (
                        <span className="block max-w-40 truncate text-[11px] text-gray-400 dark:text-(--sa-muted)">
                          {row.email}
                        </span>
                      )}
                    </TD>

                    <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">
                      {row.city ?? "—"}
                    </TD>

                    <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">
                      {row.branch?.name ?? "—"}
                    </TD>

                    <TD className="whitespace-nowrap">
                      <Badge tone={TYPE_TONE[row.customerType]}>{labelise(row.customerType)}</Badge>
                    </TD>

                    <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">
                      {labelise(row.entrySource)}
                    </TD>

                    <TD className="whitespace-nowrap">
                      <Badge tone={row.isManualEntry ? "warning" : "neutral"}>
                        {row.isManualEntry ? "Manual" : "Registered"}
                      </Badge>
                    </TD>

                    <TD className="whitespace-nowrap text-xs">
                      {membership ? (
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {membership.plan.name}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-(--sa-muted)">—</span>
                      )}
                    </TD>

                    <TD className="whitespace-nowrap text-xs text-gray-600 dark:text-(--sa-text-2)">
                      {row.totalVisits}
                    </TD>

                    <TD className="whitespace-nowrap text-xs font-medium text-gray-800 dark:text-(--sa-text)">
                      {formatCurrency(row.totalSpend)}
                    </TD>

                    <TD className="whitespace-nowrap text-xs text-gray-500 dark:text-(--sa-text-2)">
                      {formatDate(row.createdAt)}
                    </TD>

                    {(capability.canEdit || capability.canDelete) && (
                      <TD className="whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {capability.canEdit && !row.deletedAt && (
                            <button
                              type="button"
                              onClick={() => setEditing(row)}
                              aria-label={`Edit ${row.firstName}`}
                              className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-(--sa-text)"
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                            </button>
                          )}
                          {capability.canDelete && !row.deletedAt && (
                            <button
                              type="button"
                              onClick={() => setDeleting(row)}
                              aria-label={`Delete ${row.firstName}`}
                              className="rounded p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </TD>
                    )}
                  </TR>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-(--sa-text-2)">
        <span>
          {total} customer{total === 1 ? "" : "s"}
          {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
        </span>
        {totalPages > 1 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className={cn(btnGhost, "disabled:opacity-40")}
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className={cn(btnGhost, "disabled:opacity-40")}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────── */}
      {capability.canCreate && (
        <NewCustomerDialog
          open={creating}
          onClose={() => setCreating(false)}
          endpoint={endpoint}
          branches={branches}
          capability={capability}
          profileBasePath={profileBasePath}
          bookingPath={bookingPath}
        />
      )}
      {capability.canEdit && (
        <EditCustomerDialog
          customer={editing}
          onClose={() => setEditing(null)}
          endpointBase={endpoint}
          branches={branches}
          canChooseBranch={capability.canChooseBranch}
        />
      )}
      {capability.canDelete && (
        <DeleteCustomerDialog
          customer={deleting}
          onClose={() => setDeleting(null)}
          endpointBase={endpoint}
        />
      )}
      {capability.canImportExport && (
        <ImportCustomersDialog
          open={importing}
          onClose={() => setImporting(false)}
          endpoint={importEndpoint}
        />
      )}
    </div>
  );
}
