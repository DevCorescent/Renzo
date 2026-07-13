import { NextRequest } from "next/server";
import { created, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { applyStockMovement, InsufficientStockError } from "@/lib/stock";
import type { StockMovementType } from "@prisma/client";

// Types a human may record by hand. PURCHASE_IN / TRANSFER_* are owned by the
// purchase-receive and transfer flows and must not be booked manually.
const MANUAL_TYPES: StockMovementType[] = [
  "DAMAGE", "EXPIRY", "SERVICE_USE", "RETAIL_SALE", "ADJUSTMENT",
];

// Everything except ADJUSTMENT only ever removes stock.
const OUTBOUND_ONLY: StockMovementType[] = ["DAMAGE", "EXPIRY", "SERVICE_USE", "RETAIL_SALE"];

// OWNER: Shalmon | MODULE: Stock — manual adjustment
// POST /api/v1/admin/inventory/stock/adjust
// Body: { productId, branchId, type, delta, notes? }
//   `delta` is signed: -5 removes five units, +5 adds five.
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const productId: string = typeof body.productId === "string" ? body.productId : "";
    const branchId: string = typeof body.branchId === "string" ? body.branchId : "";
    const type: StockMovementType = body.type;
    const delta = Number(body.delta);

    const errors: Record<string, string[]> = {};
    if (!productId) errors.productId = ["productId is required"];
    if (!branchId) errors.branchId = ["branchId is required"];
    if (!MANUAL_TYPES.includes(type)) {
      errors.type = [`type must be one of: ${MANUAL_TYPES.join(", ")}`];
    }
    if (!Number.isFinite(delta) || delta === 0) {
      errors.delta = ["delta must be a non-zero number"];
    } else if (OUTBOUND_ONLY.includes(type) && delta > 0) {
      errors.delta = [`${type} must use a negative delta (stock leaving)`];
    }
    if (Object.keys(errors).length) return err("Validation failed", 422, errors);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return err("Product not found", 404);

    const result = await prisma.$transaction((tx) =>
      applyStockMovement(tx, {
        productId,
        branchId,
        delta,
        type,
        refId: null,
        notes: typeof body.notes === "string" ? body.notes : null,
        performedBy: user.userId,
      })
    );

    return created(
      { productId, branchId, type, delta, ...result },
      "Stock adjusted"
    );
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return err("Insufficient stock", 422, {
        delta: [`Available quantity is ${e.available}`],
      });
    }
    return err("Internal server error", 500);
  }
}
