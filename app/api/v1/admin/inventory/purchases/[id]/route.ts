import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Purchase Orders
// GET /api/v1/admin/inventory/purchases/[id] — PO detail with items
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const order = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        branch: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
      },
    });
    if (!order) return err("Purchase order not found", 404);
    return ok(order);
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/inventory/purchases/[id] — Receive stock (or cancel)
// Body: { receipts: [{ itemId, receivedQty }] }  → partial receive
//   or: { status: "RECEIVED" }                   → receive all remaining
//   or: { status: "CANCELLED" }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const po = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
    if (!po) return err("Purchase order not found", 404);

    // Cancel path — allowed only before full receipt.
    if (body.status === "CANCELLED") {
      if (po.status === "RECEIVED") return err("Cannot cancel a received order", 409);
      const updated = await prisma.purchaseOrder.update({ where: { id }, data: { status: "CANCELLED" } });
      return ok(updated, "Purchase order cancelled");
    }

    if (po.status === "RECEIVED" || po.status === "CANCELLED") {
      return err(`Cannot receive stock for a ${po.status} order`, 409);
    }

    // Explicit per-item receipts, or receive all remaining when status→RECEIVED.
    let receipts: { itemId: string; qty: number }[];
    if (Array.isArray(body.receipts)) {
      receipts = (body.receipts as { itemId?: unknown; receivedQty?: unknown }[])
        .filter((r) => r && typeof r.itemId === "string" && Number(r.receivedQty) > 0)
        .map((r) => ({ itemId: r.itemId as string, qty: Number(r.receivedQty) }));
    } else {
      receipts = po.items
        .map((it) => ({ itemId: it.id, qty: it.orderedQty - it.receivedQty }))
        .filter((r) => r.qty > 0);
    }
    if (receipts.length === 0) return err("Nothing to receive", 422);

    const itemMap = new Map(po.items.map((it) => [it.id, it]));

    const result = await prisma.$transaction(async (tx) => {
      for (const r of receipts) {
        const item = itemMap.get(r.itemId);
        if (!item) continue;
        const delta = Math.min(r.qty, item.orderedQty - item.receivedQty);
        if (delta <= 0) continue;

        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: { receivedQty: item.receivedQty + delta },
        });

        const stock = await tx.stock.findUnique({
          where: { productId_branchId: { productId: item.productId, branchId: po.branchId } },
        });
        const before = stock?.quantity ?? 0;
        const after = before + delta;

        await tx.stock.upsert({
          where: { productId_branchId: { productId: item.productId, branchId: po.branchId } },
          update: { quantity: after },
          create: { productId: item.productId, branchId: po.branchId, quantity: after },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            branchId: po.branchId,
            type: "PURCHASE_IN",
            quantity: delta,
            balanceBefore: before,
            balanceAfter: after,
            refId: po.id,
            performedBy: user.userId,
            notes: `PO ${po.orderNo}`,
          },
        });
      }

      const freshItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: id } });
      const fullyReceived = freshItems.every((it) => it.receivedQty >= it.orderedQty);
      const anyReceived = freshItems.some((it) => it.receivedQty > 0);
      const status = fullyReceived ? "RECEIVED" : anyReceived ? "PARTIAL" : po.status;

      return tx.purchaseOrder.update({
        where: { id },
        data: { status, receivedAt: fullyReceived ? new Date() : po.receivedAt },
        include: { items: true },
      });
    });

    return ok(result, "Stock received");
  } catch {
    return err("Internal server error", 500);
  }
}
