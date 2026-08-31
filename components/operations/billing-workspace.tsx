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

export function BillingWorkspace({
  invoices,
  unbilled,
  basePath,
  showBranch,
  catalogue,
}: {
  invoices: BillingInvoiceRow[];
  unbilled: BillingUnbilledRow[];
  basePath: string;
  showBranch: boolean;
  /** Active services and products the desk can add ad-hoc to an appointment bill. */
  catalogue: CatalogueItem[];
}) {
  const [query, setQuery] = React.useState("");
  const needle = query.trim().toLowerCase();

  const filteredUnbilled = React.useMemo(() => {
    if (!needle) return unbilled;
    return unbilled.filter((row) =>
      matches(
        [row.appointmentNo, row.customerName, row.customerPhone, row.services].filter(Boolean).join(" "),
        needle,
      ),
    );
  }, [unbilled, needle]);

  const filteredInvoices = React.useMemo(() => {
    if (!needle) return invoices;
    return invoices.filter((row) =>
      matches(
        [row.invoiceNo, row.customerName, row.customerPhone, row.branchName, row.status]
          .filter(Boolean)
          .join(" "),
        needle,
      ),
    );
  }, [invoices, needle]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-(--sa-text)">Manual Billing</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-(--sa-text-2)">
            {invoices.length} recent invoice{invoices.length === 1 ? "" : "s"}
          </p>
        </div>
        <label className="relative w-full sm:max-w-sm">
          <span className="sr-only">Search invoices and customers</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
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
                  {needle ? "No matching invoices." : "No invoices yet."}
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
      </Card>
    </div>
  );
}
