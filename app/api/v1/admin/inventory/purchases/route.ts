import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { genCode } from "@/lib/codes";
import type { PurchaseOrderStatus, Prisma } from "@prisma/client";

type ItemInput = { productId: string; orderedQty: number; unitPrice: number; expiryDate?: string };

// OWNER: Shalmon | MODULE: Purchase Orders
// GET /api/v1/admin/inventory/purchases — List POs (filter branchId, status)
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url);
    const branchId = url.searchParams.get("branchId");
    const status = url.searchParams.get("status");

    const where: Prisma.PurchaseOrderWhereInput = {
      ...(branchId ? { branchId } : {}),
      ...(status ? { status: status as PurchaseOrderStatus } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { supplier: { select: { name: true } }, _count: { select: { items: true } } },
      }),
      prisma.purchaseOrder.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/inventory/purchases — Create a purchase order with line items
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const supplierId: string = typeof body.supplierId === "string" ? body.supplierId : "";
    const branchId: string = typeof body.branchId === "string" ? body.branchId : "";
    const rawItems: unknown = body.items;

    const errors: Record<string, string[]> = {};
    if (!supplierId) errors.supplierId = ["supplierId is required"];
    if (!branchId) errors.branchId = ["branchId is required"];
    if (!Array.isArray(rawItems) || rawItems.length === 0) errors.items = ["At least one item is required"];
    if (Object.keys(errors).length) return err("Validation failed", 422, errors);

    const items: ItemInput[] = (rawItems as ItemInput[])
      .filter((i) => i && typeof i.productId === "string" && Number(i.orderedQty) > 0)
      .map((i) => ({
        productId: i.productId,
        orderedQty: Number(i.orderedQty),
        unitPrice: Number(i.unitPrice) || 0,
        expiryDate: i.expiryDate,
      }));
    if (items.length === 0) return err("Validation failed", 422, { items: ["No valid line items"] });

    const totalAmount = items.reduce((sum, i) => sum + i.orderedQty * i.unitPrice, 0);

    const order = await prisma.purchaseOrder.create({
      data: {
        orderNo: genCode("PO"),
        supplierId,
        branchId,
        status: body.status === "ORDERED" ? "ORDERED" : "DRAFT",
        totalAmount,
        notes: typeof body.notes === "string" ? body.notes : null,
        orderedAt: body.status === "ORDERED" ? new Date() : null,
        createdBy: user.userId,
        items: {
          create: items.map((i) => ({
            productId: i.productId,
            orderedQty: i.orderedQty,
            unitPrice: i.unitPrice,
            totalPrice: i.orderedQty * i.unitPrice,
            expiryDate: i.expiryDate ? new Date(i.expiryDate) : null,
          })),
        },
      },
      include: { items: true },
    });
    return created(order, "Purchase order created");
  } catch {
    return err("Internal server error", 500);
  }
}
