import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, branchWhere } from "@/lib/branch-scope";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

// OWNER: Shalmon | MODULE: Stock
// GET /api/v1/admin/inventory/stock — Stock levels (filter branchId, productId, lowStock)
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  const url = new URL(req.url);
  // BRANCH ISOLATION from the SESSION, never the URL: a BRANCH_ADMIN is pinned to
  // their own branch (any ?branchId is ignored); GLOBAL roles (SUPER_ADMIN / OWNER /
  // INVENTORY_MANAGER) keep their existing ability to narrow with ?branchId. This
  // closes a hole where a branch admin could read another branch's stock by editing
  // the query string.
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  try {
    const { page, limit, skip } = parsePagination(url);
    const productId = url.searchParams.get("productId");
    const search = url.searchParams.get("search")?.trim();
    const categoryId = url.searchParams.get("categoryId")?.trim();
    const supplierId = url.searchParams.get("supplierId")?.trim();
    const status = url.searchParams.get("status"); // "low" | "out"
    const flag = url.searchParams.get("flag"); // "retail" | "consumable" | "active"
    const sortBy = url.searchParams.get("sortBy") ?? "updated";
    const sortOrder: Prisma.SortOrder =
      url.searchParams.get("sortOrder")?.toLowerCase() === "asc" ? "asc" : "desc";

    // Product-level filters live UNDER the `product` relation, so branch scope (on
    // Stock) is preserved — a filter can narrow but never widen past the branch.
    const productFilter: Prisma.ProductWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { sku: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(flag === "retail" ? { isRetail: true } : {}),
      ...(flag === "consumable" ? { isConsumable: true } : {}),
      ...(flag === "active" ? { isActive: true } : {}),
    };

    const where: Prisma.StockWhereInput = {
      ...branchWhere(scope),
      ...(productId ? { productId } : {}),
      ...(Object.keys(productFilter).length ? { product: productFilter } : {}),
      ...(status === "out" ? { quantity: { lte: 0 } } : {}),
    };

    // LOW STOCK is `quantity <= product.reorderLevel` — a comparison between columns
    // on two different models, which Prisma's `where` cannot express. So the low
    // filter resolves the matching stock ids in a lightweight pre-pass (id + the two
    // numbers only) and narrows the paginated query to them, keeping counts/paging
    // correct.
    if (status === "low") {
      const candidates = await prisma.stock.findMany({
        where: {
          ...branchWhere(scope),
          ...(Object.keys(productFilter).length ? { product: productFilter } : {}),
        },
        select: { id: true, quantity: true, product: { select: { reorderLevel: true } } },
      });
      where.id = {
        in: candidates
          .filter((s) => s.quantity > 0 && s.quantity <= (s.product?.reorderLevel ?? 0))
          .map((s) => s.id),
      };
    }

    const orderBy: Prisma.StockOrderByWithRelationInput =
      sortBy === "stock"
        ? { quantity: sortOrder }
        : sortBy === "name"
          ? { product: { name: sortOrder } }
          : sortBy === "category"
            ? { product: { categoryId: sortOrder } }
            : { updatedAt: sortOrder };

    const [items, total] = await Promise.all([
      prisma.stock.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          product: {
            select: {
              id: true, name: true, sku: true, brand: true, image: true, unit: true,
              purchasePrice: true, sellingPrice: true, reorderLevel: true,
              isRetail: true, isConsumable: true, isActive: true,
              category: { select: { name: true } },
              supplier: { select: { name: true } },
            },
          },
          branch: { select: { id: true, name: true } },
        },
      }),
      prisma.stock.count({ where }),
    ]);

    // Derived, per the prompt, from the existing Stock/Product columns only:
    //   available = on-hand − reserved · out = nothing on hand · low = at/below
    //   reorder while still positive. The badge colour is chosen from these on the UI.
    const withFlags = items.map((s) => ({
      ...s,
      availableQty: s.quantity - s.reservedQty,
      isOut: s.quantity <= 0,
      isLow: s.quantity > 0 && s.quantity <= (s.product?.reorderLevel ?? 0),
    }));
    return paginated(withFlags, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
