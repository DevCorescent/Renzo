"use client";

// Stock table for the Inventory dashboard — thin client wrapper around DataTable.
// Data passed in already-fetched (plain objects); no fetching, no mutation.
import * as React from "react";
import { Package, Building2 } from "lucide-react";
import { DataTable, type Column } from "./data-table";
import { StatusBadge } from "./status-badge";

export type StockRow = {
  id: string;
  product: string;
  sku: string;
  branch: string;
  quantity: number;
  reorder: number;
  low: boolean;
};

export function InventoryTable({ rows }: { rows: StockRow[] }) {
  const columns = React.useMemo<Column<StockRow>[]>(
    () => [
      {
        key: "product",
        header: "Product",
        sortable: true,
        sortValue: (r) => r.product,
        cell: (r) => (
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-(--sa-text-2)">
              <Package className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900 dark:text-(--sa-text)">{r.product}</p>
              <p className="truncate font-mono text-[11px] text-gray-400 dark:text-(--sa-muted)">{r.sku}</p>
            </div>
          </div>
        ),
      },
      {
        key: "branch",
        header: "Branch",
        sortable: true,
        sortValue: (r) => r.branch,
        cell: (r) => (
          <span className="inline-flex items-center gap-1.5 text-gray-600 dark:text-(--sa-text-2)">
            <Building2 className="size-3.5 text-gray-400 dark:text-(--sa-muted)" />
            {r.branch}
          </span>
        ),
      },
      {
        key: "quantity",
        header: "In stock",
        align: "right",
        sortable: true,
        sortValue: (r) => r.quantity,
        cell: (r) => <span className="tabular-nums font-medium text-gray-900 dark:text-(--sa-text)">{r.quantity}</span>,
      },
      {
        key: "reorder",
        header: "Reorder at",
        align: "right",
        sortable: true,
        sortValue: (r) => r.reorder,
        cell: (r) => <span className="tabular-nums text-gray-500 dark:text-(--sa-muted)">{r.reorder}</span>,
      },
      {
        key: "status",
        header: "Status",
        align: "right",
        sortable: true,
        sortValue: (r) => (r.low ? 0 : 1),
        cell: (r) => <StatusBadge tone={r.low ? "danger" : "success"}>{r.low ? "Low stock" : "In stock"}</StatusBadge>,
      },
    ],
    []
  );

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.id}
      searchPlaceholder="Search products…"
      initialSort={{ key: "quantity", dir: "asc" }}
      pageSize={8}
      empty={{ title: "No stock records", description: "Product stock levels will appear here." }}
    />
  );
}
