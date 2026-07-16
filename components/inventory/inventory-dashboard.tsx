// ============================================================================
// OWNER  : Gauransh
// MODULE : Inventory (UI) — dashboard (shared by Branch Admin & Super Admin)
//
// One Server Component powers both roles' inventory dashboard. It fetches the
// stock page through the (branch-scoped) stock API — so a Branch Admin is pinned
// to their branch by the backend, not by this UI — computes the summary cards via
// lib/inventory-summary for the resolved scope, and renders cards + filters + table
// in a single pass (no per-tab or per-card query).
//
// SCOPE RESOLUTION
//   Branch Admin  → their SESSION branch; a ?branchId is neither forwarded nor
//                   trusted (the API ignores it regardless).
//   Super Admin   → may narrow to a chosen ?branchId, else all branches.
//
// RESPONSE SHAPES DIFFER (and are handled, not assumed): inventory categories is a
// bare array (ok), while suppliers and branches are paginated (data.items).
// ============================================================================

import { ClipboardList } from "lucide-react";
import { apiGet } from "@/lib/api-server";
import { API } from "@/lib/endpoints";
import type { AuthUser } from "@/types/api";
import { getInventorySummary } from "@/lib/inventory-summary";
import { InventorySummaryCards } from "./inventory-summary-cards";
import { InventoryToolbar } from "./inventory-toolbar";
import { InventoryTable } from "./inventory-table";
import { AddItemButton } from "./add-item-button";
import type { Option, Paginated, StockRow } from "./types";

type SearchParams = Record<string, string | string[] | undefined>;

// Params forwarded to the stock API. branchId is passed ONLY for a Super Admin.
const PASSTHROUGH = ["search", "categoryId", "supplierId", "status", "flag", "sortBy", "sortOrder", "page", "limit", "branchId"] as const;

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
}

export async function InventoryDashboard({
  authUser,
  searchParams,
  isSuperAdmin,
  title,
  subtitle,
}: {
  authUser: AuthUser;
  searchParams: SearchParams;
  isSuperAdmin: boolean;
  title: string;
  subtitle: string;
}) {
  // The branch the SUMMARY is computed for (the table is scoped by the API itself).
  const scopedBranchId = isSuperAdmin ? one(searchParams.branchId) ?? null : authUser.branchId ?? null;

  const params = new URLSearchParams();
  for (const key of PASSTHROUGH) {
    if (key === "branchId" && !isSuperAdmin) continue; // branch admin: never forward it
    const v = one(searchParams[key]);
    if (v) params.set(key, v);
  }

  const [stockRes, catRes, supRes, brRes, summary] = await Promise.all([
    apiGet<Paginated<StockRow>>(`${API.admin.stock}?${params.toString()}`),
    apiGet<Option[]>(`${API.admin.productCategories}?limit=100`),
    apiGet<Paginated<Option>>(`${API.admin.suppliers}?limit=100`),
    isSuperAdmin ? apiGet<Paginated<Option>>(`${API.admin.branches}?limit=100`) : Promise.resolve(null),
    getInventorySummary(scopedBranchId),
  ]);

  const categories = catRes.ok ? catRes.data : [];
  const suppliers = supRes.ok ? supRes.data.items : [];
  const branches = brRes && brRes.ok ? brRes.data.items : [];
  const now = summary.generatedAt;

  return (
    <div className="space-y-5">
      {/* Header with the top-right primary action (both roles). The button is a client
          island; the option lists it needs are already loaded here. */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
        </div>
        <AddItemButton categories={categories} suppliers={suppliers} branches={branches} isSuperAdmin={isSuperAdmin} />
      </div>

      <InventorySummaryCards summary={summary} />

      <InventoryToolbar categories={categories} suppliers={suppliers} branches={branches} />

      {!stockRes.ok ? (
        <div className="flex flex-col items-center justify-center rounded border border-red-100 bg-red-50/50 px-6 py-14 text-center">
          <ClipboardList className="size-6 text-red-400" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold text-gray-900">Could not load inventory</h3>
          <p className="mt-1 text-xs text-gray-500">{stockRes.message}</p>
        </div>
      ) : (
        <InventoryTable
          rows={stockRes.data.items}
          total={stockRes.data.total}
          page={stockRes.data.page}
          limit={stockRes.data.limit}
          totalPages={stockRes.data.totalPages}
          now={now}
          showBranch={isSuperAdmin}
          canManage={isSuperAdmin}
          categories={categories}
          suppliers={suppliers}
        />
      )}
    </div>
  );
}
