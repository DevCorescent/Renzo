import prisma from "@/lib/db";
import type { StockMovementType } from "@prisma/client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Inventory — dashboard summary
//
// PURPOSE
//   Computes the inventory summary cards for one SCOPE — a single branch (Branch
//   Admin, or a Super Admin who narrowed to a branch) or all branches (Super Admin
//   with no branch chosen). Every figure comes from the existing Stock / Product /
//   StockMovement / PurchaseOrder / StockTransfer tables; nothing is stored.
//
// BRANCH ISOLATION
//   The scope is a resolved branchId (null = all branches) that the CALLER derives
//   from the session — this module never reads a branchId from the request, so it
//   cannot be tricked into crossing branches.
//
// CALCULATIONS (no column exists for these — they are derived)
//   • value  = Σ quantity × purchasePrice   • out = quantity ≤ 0
//   • low    = 0 < quantity ≤ reorderLevel   • reorder = quantity ≤ reorderLevel
//   These need on-hand vs the product's reorder level / price (columns on two
//   models), so they are computed in memory over a lightweight scoped read rather
//   than faked with an aggregate that Prisma cannot express.
// ============================================================================

// Movements that ADD to a branch's on-hand vs those that REMOVE it. ADJUSTMENT is
// signed, so its direction is read from the balance delta, not the type.
const INBOUND: StockMovementType[] = ["PURCHASE_IN", "TRANSFER_IN"];

export type InventorySummary = {
  totalProducts: number;
  activeProducts: number;
  outOfStock: number;
  lowStock: number;
  reorderRequired: number;
  inventoryValue: number;
  todayStockIn: number;
  todayStockOut: number;
  purchaseOrders: number;
  transfers: number;
  /** Server clock at compute time — the UI uses it for the "updated today" accent
   *  (a component may not call Date.now() during render; this is computed here). */
  generatedAt: number;
};

/** Compute the summary for a scope. `branchId` null = every branch (platform view). */
export async function getInventorySummary(branchId: string | null): Promise<InventorySummary> {
  const stockWhere = branchId ? { branchId } : {};

  // Start of today, UTC-pinned like every other date boundary in the codebase.
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [stockRows, todayMovements, purchaseOrders, transfers] = await Promise.all([
    // Lightweight scoped read — only the numbers the derived cards need.
    prisma.stock.findMany({
      where: stockWhere,
      select: {
        quantity: true,
        product: { select: { purchasePrice: true, reorderLevel: true, isActive: true } },
      },
    }),
    prisma.stockMovement.findMany({
      where: { ...stockWhere, createdAt: { gte: todayStart } },
      select: { type: true, quantity: true, balanceBefore: true, balanceAfter: true },
    }),
    prisma.purchaseOrder.count({ where: stockWhere }),
    prisma.stockTransfer.count({
      where: branchId ? { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] } : {},
    }),
  ]);

  let activeProducts = 0;
  let outOfStock = 0;
  let lowStock = 0;
  let reorderRequired = 0;
  let inventoryValue = 0;

  for (const s of stockRows) {
    const reorder = s.product?.reorderLevel ?? 0;
    if (s.product?.isActive) activeProducts += 1;
    if (s.quantity <= 0) outOfStock += 1;
    else if (s.quantity <= reorder) lowStock += 1;
    if (s.quantity <= reorder) reorderRequired += 1;
    inventoryValue += s.quantity * (s.product?.purchasePrice ?? 0);
  }

  let todayStockIn = 0;
  let todayStockOut = 0;
  for (const m of todayMovements) {
    if (m.type === "ADJUSTMENT") {
      const delta = m.balanceAfter - m.balanceBefore;
      if (delta >= 0) todayStockIn += delta;
      else todayStockOut += -delta;
    } else if (INBOUND.includes(m.type)) {
      todayStockIn += m.quantity;
    } else {
      todayStockOut += m.quantity;
    }
  }

  return {
    totalProducts: stockRows.length,
    activeProducts,
    outOfStock,
    lowStock,
    reorderRequired,
    inventoryValue: Math.round(inventoryValue),
    todayStockIn: Math.round(todayStockIn),
    todayStockOut: Math.round(todayStockOut),
    purchaseOrders,
    transfers,
    generatedAt: now.getTime(),
  };
}
