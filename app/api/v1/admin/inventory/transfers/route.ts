import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { genCode } from "@/lib/codes";
import type { StockTransferStatus, Prisma } from "@prisma/client";

type ItemInput = { productId: string; quantity: number };

// OWNER: Shalmon | MODULE: Stock Transfers
// GET /api/v1/admin/inventory/transfers — List transfers (filter branch, status)
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url);
    const status = url.searchParams.get("status");
    const branchId = url.searchParams.get("branchId");

    const where: Prisma.StockTransferWhereInput = {
      ...(status ? { status: status as StockTransferStatus } : {}),
      ...(branchId ? { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          fromBranch: { select: { name: true } },
          toBranch: { select: { name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.stockTransfer.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/inventory/transfers — Create a transfer request (PENDING)
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const fromBranchId: string = typeof body.fromBranchId === "string" ? body.fromBranchId : "";
    const toBranchId: string = typeof body.toBranchId === "string" ? body.toBranchId : "";
    const rawItems: unknown = body.items;

    const errors: Record<string, string[]> = {};
    if (!fromBranchId) errors.fromBranchId = ["fromBranchId is required"];
    if (!toBranchId) errors.toBranchId = ["toBranchId is required"];
    if (fromBranchId && fromBranchId === toBranchId) errors.toBranchId = ["Source and destination must differ"];
    if (!Array.isArray(rawItems) || rawItems.length === 0) errors.items = ["At least one item is required"];
    if (Object.keys(errors).length) return err("Validation failed", 422, errors);

    const items: ItemInput[] = (rawItems as ItemInput[])
      .filter((i) => i && typeof i.productId === "string" && Number(i.quantity) > 0)
      .map((i) => ({ productId: i.productId, quantity: Number(i.quantity) }));
    if (items.length === 0) return err("Validation failed", 422, { items: ["No valid line items"] });

    const transfer = await prisma.stockTransfer.create({
      data: {
        transferNo: genCode("TRF"),
        fromBranchId,
        toBranchId,
        status: "PENDING",
        notes: typeof body.notes === "string" ? body.notes : null,
        requestedBy: user.userId,
        items: { create: items.map((i) => ({ productId: i.productId, quantity: i.quantity })) },
      },
      include: { items: true },
    });
    return created(transfer, "Stock transfer created");
  } catch {
    return err("Internal server error", 500);
  }
}
