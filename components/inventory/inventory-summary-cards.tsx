// ============================================================================
// OWNER  : Gauransh
// MODULE : Inventory (UI) — summary cards
//
// Presentational KPI band, reusing the shared StatCard. Every number is computed
// server-side by lib/inventory-summary (scoped to the branch), so this component
// just renders — no fetching, no calculation.
// ============================================================================

import * as React from "react";
import {
  Package, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Wallet,
  ArrowDownToLine, ArrowUpFromLine, ClipboardList, ArrowLeftRight,
} from "lucide-react";
import { StatCard } from "@/components/shared/ui";
import type { InventorySummary } from "@/lib/inventory-summary";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function InventorySummaryCards({ summary }: { summary: InventorySummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard label="Total products" value={summary.totalProducts.toLocaleString("en-IN")} icon={Package} />
      <StatCard label="Active" value={summary.activeProducts.toLocaleString("en-IN")} icon={CheckCircle2} />
      <StatCard label="Out of stock" value={summary.outOfStock.toLocaleString("en-IN")} icon={XCircle} />
      <StatCard label="Low stock" value={summary.lowStock.toLocaleString("en-IN")} icon={AlertTriangle} />
      <StatCard label="Reorder required" value={summary.reorderRequired.toLocaleString("en-IN")} icon={RefreshCw} />
      <StatCard label="Inventory value" value={money(summary.inventoryValue)} icon={Wallet} />
      <StatCard label="Today's stock in" value={summary.todayStockIn.toLocaleString("en-IN")} icon={ArrowDownToLine} />
      <StatCard label="Today's stock out" value={summary.todayStockOut.toLocaleString("en-IN")} icon={ArrowUpFromLine} />
      <StatCard label="Purchase orders" value={summary.purchaseOrders.toLocaleString("en-IN")} icon={ClipboardList} />
      <StatCard label="Transfers" value={summary.transfers.toLocaleString("en-IN")} icon={ArrowLeftRight} />
    </div>
  );
}
