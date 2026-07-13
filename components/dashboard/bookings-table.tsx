"use client";

// Customer booking-history table — thin client wrapper that defines columns for
// the generic DataTable. Data is passed in already-fetched (plain objects); adds
// no fetching and no mutation.
import * as React from "react";
import { CalendarDays, Clock, Scissors, Building2 } from "lucide-react";
import { DataTable, type Column } from "./data-table";
import { StatusBadge, statusTone } from "./status-badge";

export type BookingRow = {
  id: string;
  date: string;
  dateSort: number;
  time: string;
  service: string;
  branch: string;
  city?: string;
  amount: number;
  status: string;
  href?: string;
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function BookingsTable({ rows }: { rows: BookingRow[] }) {
  const columns = React.useMemo<Column<BookingRow>[]>(
    () => [
      {
        key: "date",
        header: "Date",
        sortable: true,
        sortValue: (r) => r.dateSort,
        cell: (r) => (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-gray-600 dark:text-(--sa-text-2)">
            <CalendarDays className="size-3.5 text-gray-400 dark:text-(--sa-muted)" />
            {r.date}
          </span>
        ),
      },
      {
        key: "time",
        header: "Time",
        cell: (r) => (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-gray-500 dark:text-(--sa-muted)">
            <Clock className="size-3.5 text-gray-400 dark:text-(--sa-muted)" />
            {r.time}
          </span>
        ),
      },
      {
        key: "service",
        header: "Service",
        sortable: true,
        sortValue: (r) => r.service,
        cell: (r) => (
          <span className="inline-flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-(--sa-text-2)">
              <Scissors className="size-4" />
            </span>
            <span className="truncate font-medium text-gray-900 dark:text-(--sa-text)">{r.service}</span>
          </span>
        ),
      },
      {
        key: "branch",
        header: "Branch",
        sortable: true,
        sortValue: (r) => r.branch,
        cell: (r) => (
          <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-(--sa-text-2)">
            <Building2 className="size-3.5 shrink-0 text-gray-400 dark:text-(--sa-muted)" />
            <span className="min-w-0">
              <span className="block truncate">{r.branch}</span>
              {r.city && <span className="block truncate text-[11px] text-gray-400 dark:text-(--sa-muted)">{r.city}</span>}
            </span>
          </span>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        align: "right",
        sortable: true,
        sortValue: (r) => r.amount,
        cell: (r) => <span className="font-medium tabular-nums text-gray-900 dark:text-(--sa-text)">{inr(r.amount)}</span>,
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
      getRowHref={(r) => r.href}
      searchPlaceholder="Search bookings…"
      initialSort={{ key: "date", dir: "desc" }}
      pageSize={10}
      empty={{ title: "No bookings yet", description: "Your appointment history will appear here." }}
    />
  );
}
