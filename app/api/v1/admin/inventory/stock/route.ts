import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

// OWNER: Shalmon | MODULE: Stock
// GET /api/v1/admin/inventory/stock — Stock levels (filter branchId, productId, lowStock)
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url);
    const branchId = url.searchParams.get("branchId");
    const productId = url.searchParams.get("productId");

    const where: Prisma.StockWhereInput = {
      ...(branchId ? { branchId } : {}),
      ...(productId ? { productId } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.stock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          product: { select: { name: true, sku: true, unit: true, reorderLevel: true } },
          branch: { select: { name: true } },
        },
      }),
      prisma.stock.count({ where }),
    ]);

    // Flag items at/below their reorder level for the UI.
    const withFlags = items.map((s) => ({
      ...s,
      isLow: s.quantity <= (s.product?.reorderLevel ?? 0),
    }));
    return paginated(withFlags, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
