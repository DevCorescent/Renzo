import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { parseDateRange } from "@/lib/reports";
import type { Prisma } from "@prisma/client";

// OWNER: Shalmon | MODULE: Inventory Report
// GET /api/v1/admin/reports/inventory?branchId&from&to
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { from, to } = parseDateRange(url);
    const branchId = url.searchParams.get("branchId");

    const stockWhere: Prisma.StockWhereInput = branchId ? { branchId } : {};
    const movementWhere: Prisma.StockMovementWhereInput = {
      createdAt: { gte: from, lte: to },
      ...(branchId ? { branchId } : {}),
    };

    const [stocks, movements, purchaseAgg] = await Promise.all([
      prisma.stock.findMany({
        where: stockWhere,
        include: {
          product: { select: { name: true, sku: true, reorderLevel: true, unit: true } },
          branch: { select: { name: true } },
        },
      }),
      prisma.stockMovement.groupBy({
        by: ["type"],
        where: movementWhere,
        _sum: { quantity: true },
        _count: { _all: true },
      }),
      prisma.purchaseOrder.aggregate({
        _sum: { totalAmount: true },
        where: {
          createdAt: { gte: from, lte: to },
          status: { in: ["RECEIVED", "PARTIAL"] },
          ...(branchId ? { branchId } : {}),
        },
      }),
    ]);

    const lowStock = stocks
      .filter((s) => s.quantity <= (s.product?.reorderLevel ?? 0))
      .map((s) => ({
        productId: s.productId,
        name: s.product?.name,
        sku: s.product?.sku,
        unit: s.product?.unit,
        branch: s.branch?.name,
        quantity: s.quantity,
        reorderLevel: s.product?.reorderLevel ?? 0,
      }));

    return ok({
      from,
      to,
      totalStockRecords: stocks.length,
      lowStockCount: lowStock.length,
      lowStock,
      usageByType: movements.map((m) => ({
        type: m.type,
        totalQty: Number((m._sum.quantity ?? 0).toFixed(2)),
        movements: m._count._all,
      })),
      purchaseTotal: Number((purchaseAgg._sum.totalAmount ?? 0).toFixed(2)),
    });
  } catch {
    return err("Internal server error", 500);
  }
}
