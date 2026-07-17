// OWNER: Gauransh
// MODULE: Inventory Management

import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, branchWhere } from "@/lib/branch-scope";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

// GET /api/v1/admin/inventory/stock/movements?productId&branchId&page&limit
// The Stock History ledger for a product. There was no read endpoint for the
// StockMovement audit trail (only the purchase-receive / report code touched it),
// so this is the one genuinely-missing capability the Inventory UI needs — every
// other action reuses an existing route.
export async function GET(req: NextRequest) {
  // PERMISSION: same four roles as the rest of inventory read surface.
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  const url = new URL(req.url);

  // BRANCH ISOLATION from the SESSION, never the URL: a BRANCH_ADMIN only ever sees
  // their own branch's ledger; a ?branchId is ignored for them and honoured only for
  // GLOBAL roles narrowing the view. This mirrors the stock list endpoint exactly.
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  try {
    const { page, limit, skip } = parsePagination(url);
    const productId = url.searchParams.get("productId")?.trim();
    if (!productId) return err("Validation failed", 422, { productId: ["productId is required"] });

    // Scope + subject. branchWhere pins a branch admin; global callers may narrow.
    const where: Prisma.StockMovementWhereInput = {
      productId,
      ...branchWhere(scope),
    };

    const [items, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { product: { select: { name: true, sku: true, unit: true } } },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    // performedBy is a raw userId (no relation on the model), so resolve the actors
    // in one lightweight follow-up query rather than N per-row lookups. The User model
    // has no display name (names live on profile tables), so identify by email/phone.
    const actorIds = [...new Set(items.map((m) => m.performedBy))];
    const actors = actorIds.length
      ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true, phone: true } })
      : [];
    const actorName = new Map(actors.map((a) => [a.id, a.email ?? a.phone ?? "User"]));

    const withActor = items.map((m) => ({
      ...m,
      performedByName: actorName.get(m.performedBy) ?? "System",
    }));

    return paginated(withActor, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
