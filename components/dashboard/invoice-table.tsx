"use client";

// Invoice table for the Accountant dashboard — thin client wrapper around DataTable.
import * as React from "react";
import { Receipt, User } from "lucide-react";
import { DataTable, type Column } from "./data-table";
import { StatusBadge, statusTone } from "./status-badge";

export type InvoiceRow = {
  id: string;
  invoiceNo: string;
  customer: string;
  date: string;
  dateSort: number;
  amount: number;
  balance: number;
  status: string;
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function InvoiceTable({ rows }: { rows: InvoiceRow[] }) {
  const columns = React.useMemo<Column<InvoiceRow>[]>(
    () => [
      {
        key: "invoiceNo",
        header: "Invoice",
        sortable: true,
        sortValue: (r) => r.invoiceNo,
        cell: (r) => (
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-(--sa-text-2)">
              <Receipt className="size-4" />
            </span>
            <p className="truncate font-mono text-xs font-medium text-gray-900 dark:text-(--sa-text)">{r.invoiceNo}</p>
          </div>
        ),
      },
      {
        key: "customer",
        header: "Customer",
        sortable: true,
        sortValue: (r) => r.customer,
        cell: (r) => (
          <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-(--sa-text-2)">
            <User className="size-3.5 text-gray-400 dark:text-(--sa-muted)" />
            {r.customer}
          </span>
        ),
      },
      {
        key: "date",
        header: "Date",
        sortable: true,
        sortValue: (r) => r.dateSort,
        cell: (r) => <span className="font-mono text-xs text-gray-500 dark:text-(--sa-muted)">{r.date}</span>,
      },
      {
        key: "amount",
        header: "Amount",
        align: "right",
        sortable: true,
        sortValue: (r) => r.amount,
        cell: (r) => <span className="tabular-nums font-medium text-gray-900 dark:text-(--sa-text)">{inr(r.amount)}</span>,
      },
      {
        key: "balance",
        header: "Balance",
        align: "right",
        sortable: true,
        sortValue: (r) => r.balance,
        cell: (r) => (
          <span className={r.balance > 0 ? "tabular-nums font-medium text-amber-600 dark:text-amber-400" : "tabular-nums text-gray-400 dark:text-(--sa-muted)"}>
            {inr(r.balance)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        align: "right",
        sortable: true,
        sortValue: (r) => r.status,
        cell: (r) => <StatusBadge tone={statusTone(r.status)}>{r.status.replace(/_/g, " ")}</StatusBadge>,
      },
    ],
    []
  );

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      searchPlaceholder="Search invoices…"
      initialSort={{ key: "date", dir: "desc" }}
      pageSize={10}
      empty={{ title: "No invoices yet", description: "Billing records will appear here." }}
    />
  );
}
