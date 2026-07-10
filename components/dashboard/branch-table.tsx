"use client";

// Branch overview table — thin client wrapper that defines columns for the
// generic DataTable. Data is passed in already-fetched (plain objects); this
// component adds no fetching and no mutation.
import * as React from "react";
import { Building2, MapPin, Users, CalendarClock } from "lucide-react";
import { DataTable, type Column } from "./data-table";
import { StatusBadge } from "./status-badge";

export type BranchRow = {
  id: string;
  name: string;
  city: string;
  code: string;
  workers: number;
  today: number;
  isActive: boolean;
  href: string;
};

export function BranchTable({ rows }: { rows: BranchRow[] }) {
  const columns = React.useMemo<Column<BranchRow>[]>(
    () => [
      {
        key: "name",
        header: "Branch",
        sortable: true,
        sortValue: (r) => r.name,
        cell: (r) => (
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-(--sa-text-2)">
              <Building2 className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900 dark:text-(--sa-text)">{r.name}</p>
              <p className="truncate font-mono text-[11px] text-gray-400 dark:text-(--sa-muted)">{r.code}</p>
            </div>
          </div>
        ),
      },
      {
        key: "city",
        header: "City",
        sortable: true,
        sortValue: (r) => r.city,
        cell: (r) => (
          <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-(--sa-text-2)">
            <MapPin className="size-3.5 text-gray-400 dark:text-(--sa-muted)" />
            {r.city}
          </span>
        ),
      },
      {
        key: "workers",
        header: "Workers",
        align: "right",
        sortable: true,
        sortValue: (r) => r.workers,
        cell: (r) => (
          <span className="inline-flex items-center gap-1.5 tabular-nums text-gray-700 dark:text-(--sa-text-2)">
            <Users className="size-3.5 text-gray-400 dark:text-(--sa-muted)" />
            {r.workers}
          </span>
        ),
      },
      {
        key: "today",
        header: "Today",
        align: "right",
        sortable: true,
        sortValue: (r) => r.today,
        cell: (r) => (
          <span className="inline-flex items-center gap-1.5 tabular-nums text-gray-700 dark:text-(--sa-text-2)">
            <CalendarClock className="size-3.5 text-gray-400 dark:text-(--sa-muted)" />
            {r.today}
          </span>
        ),
      },
      {
        key: "status",
        header: "Status",
        align: "right",
        sortable: true,
        sortValue: (r) => (r.isActive ? 1 : 0),
        cell: (r) => (
          <StatusBadge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Inactive"}</StatusBadge>
        ),
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
      searchPlaceholder="Search branches…"
      initialSort={{ key: "today", dir: "desc" }}
      pageSize={8}
      empty={{ title: "No branches yet", description: "Create your first salon location to get started." }}
    />
  );
}
