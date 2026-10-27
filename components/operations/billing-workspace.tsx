"use client";

// Searchable invoice / unbilled-appointment lists used by every role's
// Manual Billing page. Filtering is client-side over the already-loaded
// page of rows — no extra query on each keystroke.

import * as React from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { AppointmentBill, type CatalogueItem } from "@/components/reception/appointment-bill";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  UNPAID: "warning",
  PARTIAL: "info",
  PAID: "success",
  REFUNDED: "neutral",
  CANCELLED: "danger",
};

export type BillingInvoiceRow = {
  id: string;
  invoiceNo: string;
  createdAt: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
  customerName: string;
  customerPhone: string | null;
  branchName: string | null;
};

export type BillingUnbilledRow = {
  id: string;
  appointmentNo: string;
  customerName: string;
  customerPhone: string | null;
  services: string;
  totalAmount: number;
};

function matches(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle);
}

/** The server-side invoice history window this page shows. */
export type BillingHistory = {
  q: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  /** Invoices matching the filters, across every page. */
  total: number;
};

export function BillingWorkspace({
  invoices,
  unbilled,
  basePath,
  showBranch,
  catalogue,
  history,
}: {
  invoices: BillingInvoiceRow[];
  unbilled: BillingUnbilledRow[];
  basePath: string;
  showBranch: boolean;
  /** Active services and products the desk can add ad-hoc to an appointment bill. */
  catalogue: CatalogueItem[];
  history: BillingHistory;
}) {
  const [query, setQuery] = React.useState(history.q);
  const needle = query.trim().toLowerCase();
  const filtering = Boolean(history.q || history.from || history.to);

  /** Same filters, another page. */
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (history.q) params.set("q", history.q);
    if (history.from) params.set("from", history.from);
    if (history.to) params.set("to", history.to);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const firstShown = history.total === 0 ? 0 : (history.page - 1) * history.pageSize + 1;
  const lastShown = Math.min(history.total, history.page * history.pageSize);
  const hasOlder = lastShown < history.total;

  const filteredUnbilled = React.useMemo(() => {
    if (!needle) return unbilled;
    return unbilled.filter((row) =>
      matches(
        [row.appointmentNo, row.customerName, row.customerPhone, row.services].filter(Boolean).join(" "),
        needle,
      ),
    );
  }, [unbilled, needle]);

  // Once a search is submitted the server has already filtered these rows; only
  // an unsubmitted edit narrows them further.
  const invoiceNeedle = query.trim() === history.q ? "" : needle;
  const filteredInvoices = React.useMemo(() => {
    const needle = invoiceNeedle;
    if (!needle) return invoices;
    return invoices.filter((row) =>
      matches(
        [row.invoiceNo, row.customerName, row.customerPhone, row.branchName, row.status]
          .filter(Boolean)
          .join(" "),
        needle,
      ),
    );
  }, [invoices, invoiceNeedle]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-(--sa-text)">Manual Billing</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-(--sa-text-2)">
            {history.total} invoice{history.total === 1 ? "" : "s"}
            {filtering ? " matching" : ""}
          </p>
        </div>
        {/* Enter / Search looks through ALL invoices on the server; typing alone
            narrows the rows already on screen, as before. */}
        <form method="get" action={basePath} className="flex w-full flex-wrap items-end gap-2 sm:max-w-2xl sm:justify-end">
        <label className="relative w-full sm:max-w-sm">
          <span className="sr-only">Search invoices and customers</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer, invoice, phone or service…"
            className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-9 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>
        <label className="text-xs text-gray-500 dark:text-(--sa-text-2)">
          From
          <input type="date" name="from" defaultValue={history.from} className={dateCls} />
        </label>
        <label className="text-xs text-gray-500 dark:text-(--sa-text-2)">
          To
          <input type="date" name="to" defaultValue={history.to} className={dateCls} />
        </label>
        <button
          type="submit"
          className="h-10 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-white/90"
        >
          Search
        </button>
        {filtering && (
          <Link href={basePath} className="h-10 content-center px-2 text-sm text-gray-500 underline-offset-2 hover:underline">
            Clear
          </Link>
        )}
        </form>
      </div>

      {needle && (
        <p className="text-xs text-gray-500 dark:text-(--sa-muted)">
          {filteredUnbilled.length + filteredInvoices.length} result
          {filteredUnbilled.length + filteredInvoices.length === 1 ? "" : "s"} for “{query.trim()}”
        </p>
      )}

      {unbilled.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ready to invoice</CardTitle>
          </CardHeader>
          <Table>
            <THead>
              <tr>
                <TH>Appt #</TH>
                <TH>Customer</TH>
                <TH>Service</TH>
                <TH>Total</TH>
                <TH className="text-right">Action</TH>
              </tr>
            </THead>
            <tbody>
              {filteredUnbilled.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                    No matching appointments.
                  </td>
                </tr>
              ) : (
                filteredUnbilled.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-mono text-xs text-gray-400">{a.appointmentNo}</TD>
                    <TD className="font-medium text-gray-900 dark:text-(--sa-text)">
                      {a.customerName}
                      {a.customerPhone && (
                        <p className="text-[11px] font-normal text-gray-400">{a.customerPhone}</p>
                      )}
                    </TD>
                    <TD className="text-xs text-gray-600 dark:text-(--sa-text-2)">{a.services || "—"}</TD>
                    <TD className="text-gray-700 dark:text-(--sa-text)">
                      ₹{a.totalAmount.toLocaleString("en-IN")}
                    </TD>
                    <TD className="align-top">
                      <div className="flex justify-end">
                        <AppointmentBill
                          appointmentId={a.id}
                          basePath={basePath}
                          catalogue={catalogue}
                          bookedServices={a.services}
                          bookedTotal={a.totalAmount}
                        />
                      </div>
                    </TD>
                  </TR>
                ))
              )}
            </tbody>
          </Table>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Invoice #</TH>
              <TH>Customer</TH>
              {showBranch && <TH>Branch</TH>}
              <TH>Date</TH>
              <TH>Total</TH>
              <TH>Paid</TH>
              <TH>Balance</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {filteredInvoices.length === 0 ? (
              <tr>
                <td
                  colSpan={showBranch ? 8 : 7}
                  className="px-4 py-8 text-center text-sm text-gray-400"
                >
                  {needle || filtering ? "No matching invoices." : "No invoices yet."}
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv) => (
                <TR key={inv.id}>
                  <TD className="font-mono text-xs">
                    <Link
                      href={`${basePath}/${inv.id}`}
                      className="text-gray-700 underline-offset-2 hover:underline dark:text-(--sa-text)"
                    >
                      {inv.invoiceNo}
                    </Link>
                  </TD>
                  <TD className="font-medium text-gray-900 dark:text-(--sa-text)">
                    {inv.customerName || "—"}
                    {inv.customerPhone && (
                      <p className="text-[11px] font-normal text-gray-400">{inv.customerPhone}</p>
                    )}
                  </TD>
                  {showBranch && (
                    <TD className="text-xs text-gray-500">{inv.branchName ?? "—"}</TD>
                  )}
                  <TD className="font-mono text-xs text-gray-500">
                    {new Date(inv.createdAt).toLocaleDateString("en-IN")}
                  </TD>
                  <TD className="text-gray-700 dark:text-(--sa-text)">
                    ₹{inv.totalAmount.toLocaleString("en-IN")}
                  </TD>
                  <TD className="text-green-700">₹{inv.paidAmount.toLocaleString("en-IN")}</TD>
                  <TD className={inv.balanceDue > 0 ? "text-red-600" : "text-gray-400"}>
                    ₹{inv.balanceDue.toLocaleString("en-IN")}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[inv.status] ?? "neutral"}>{inv.status}</Badge>
                  </TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
        {history.total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-white/5 dark:text-(--sa-text-2)">
            <span>
              Showing {firstShown}–{lastShown} of {history.total}
            </span>
            <div className="flex gap-2">
              {history.page > 1 && (
                <Link href={pageHref(history.page - 1)} className={pagerCls}>
                  ← Newer
                </Link>
              )}
              {hasOlder && (
                <Link href={pageHref(history.page + 1)} className={pagerCls}>
                  Older →
                </Link>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

const dateCls =
  "mt-1 block h-10 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)";
const pagerCls =
  "rounded-md border border-gray-200 px-3 py-1.5 font-medium text-gray-700 transition hover:bg-gray-50 dark:border-(--sa-border) dark:text-(--sa-text) dark:hover:bg-white/5";
