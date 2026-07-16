// ============================================================================
// OWNER  : Gauransh
// MODULE : Inventory (UI) — shared types
//
// Mirrors exactly what GET /api/v1/admin/inventory/stock returns (branch-scoped by
// the API, with the derived availableQty / isOut / isLow flags). A field absent
// from that response is absent here, so the UI can never render an invented value.
// ============================================================================

export type StockRow = {
  id: string;
  productId: string;
  branchId: string;
  quantity: number;
  reservedQty: number;
  updatedAt: string;
  availableQty: number;
  isOut: boolean;
  isLow: boolean;
  product: {
    id: string;
    name: string;
    sku: string;
    brand: string | null;
    image: string | null;
    unit: string;
    purchasePrice: number;
    sellingPrice: number;
    reorderLevel: number;
    isRetail: boolean;
    isConsumable: boolean;
    isActive: boolean;
    category: { name: string } | null;
    supplier: { name: string } | null;
  };
  branch: { id: string; name: string };
};

export type Option = { id: string; name: string };

/** One row of the Stock History ledger — mirrors GET .../stock/movements. */
export type MovementRow = {
  id: string;
  type: string;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  notes: string | null;
  createdAt: string;
  performedByName: string;
  product: { name: string; sku: string; unit: string };
};

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
};

export type Paginated<T> = { items: T[]; total: number; page: number; limit: number; totalPages: number };

/** on-hand ≤ 0 → out (red) · 0 < on-hand ≤ reorder → low (yellow) · else healthy (green). */
export function stockTone(row: StockRow): { label: string; tone: "danger" | "warning" | "success" } {
  if (row.isOut) return { label: "Out of stock", tone: "danger" };
  if (row.isLow) return { label: "Low stock", tone: "warning" };
  return { label: "Healthy", tone: "success" };
}

/** Updated within the last 24h — the "recently updated" (blue) accent. */
export function isRecentlyUpdated(iso: string, now: number): boolean {
  const ms = Date.parse(iso);
  return !Number.isNaN(ms) && now - ms <= 24 * 60 * 60 * 1000;
}
