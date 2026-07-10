"use client";

// Today's-schedule table — thin client wrapper that defines columns for the
// generic DataTable. Data is passed in already-fetched (plain objects); adds no
// fetching and no mutation. Shared across dashboards that show an appointment list.
import * as React from "react";
import { Clock, User, Scissors, UserCog, Building2 } from "lucide-react";
import { DataTable, type Column } from "./data-table";
import { StatusBadge, statusTone } from "./status-badge";

export type ScheduleRow = {
  id: string;
  time: string;
  startMinutes: number;
  customer: string;
  phone?: string;
  service: string;
  worker: string;
  branch?: string;
  status: string;
  href?: string;
};

export function ScheduleTable({
  rows,
  emptyTitle = "No appointments today",
  secondaryColumn = "worker",
}: {
  rows: ScheduleRow[];
  emptyTitle?: string;
  /** Fourth column: the assigned worker (default) or the branch (worker view). */
  secondaryColumn?: "worker" | "branch";
}) {
  const columns = React.useMemo<Column<ScheduleRow>[]>(() => {
    const workerCol: Column<ScheduleRow> = {
      key: "worker",
      header: "Worker",
      sortable: true,
      sortValue: (r) => r.worker,
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-(--sa-text-2)">
          <UserCog className="size-3.5 text-gray-400 dark:text-(--sa-muted)" />
          {r.worker}
        </span>
      ),
    };
    const branchCol: Column<ScheduleRow> = {
      key: "branch",
      header: "Branch",
      sortable: true,
      sortValue: (r) => r.branch ?? "",
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-(--sa-text-2)">
          <Building2 className="size-3.5 text-gray-400 dark:text-(--sa-muted)" />
          {r.branch ?? "—"}
        </span>
      ),
    };
    return [
      {
        key: "time",
        header: "Time",
        sortable: true,
        sortValue: (r) => r.startMinutes,
        cell: (r) => (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-gray-600 dark:text-(--sa-text-2)">
            <Clock className="size-3.5 text-gray-400 dark:text-(--sa-muted)" />
            {r.time}
          </span>
        ),
      },
      {
        key: "customer",
        header: "Customer",
        sortable: true,
        sortValue: (r) => r.customer,
        cell: (r) => (
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-(--sa-text-2)">
              <User className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900 dark:text-(--sa-text)">{r.customer}</p>
              {r.phone && <p className="truncate font-mono text-[11px] text-gray-400 dark:text-(--sa-muted)">{r.phone}</p>}
            </div>
          </div>
        ),
      },
      {
        key: "service",
        header: "Service",
        cell: (r) => (
          <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-(--sa-text-2)">
            <Scissors className="size-3.5 shrink-0 text-gray-400 dark:text-(--sa-muted)" />
            <span className="truncate">{r.service}</span>
          </span>
        ),
      },
      secondaryColumn === "branch" ? branchCol : workerCol,
      {
        key: "status",
        header: "Status",
        align: "right",
        sortable: true,
        sortValue: (r) => r.status,
        cell: (r) => <StatusBadge tone={statusTone(r.status)}>{r.status.replace(/_/g, " ")}</StatusBadge>,
      },
    ];
  }, [secondaryColumn]);

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      getRowHref={(r) => r.href}
      searchPlaceholder="Search appointments…"
      initialSort={{ key: "time", dir: "asc" }}
      pageSize={8}
      empty={{ title: emptyTitle, description: "New bookings for today will appear here." }}
    />
  );
}
