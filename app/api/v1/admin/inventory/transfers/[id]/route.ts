import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { applyStockMovement, InsufficientStockError } from "@/lib/stock";
import type { StockTransferStatus } from "@prisma/client";

// OWNER: Shalmon | MODULE: Stock Transfers — fulfilment
// GET /api/v1/admin/inventory/transfers/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        fromBranch: { select: { name: true } },
        toBranch: { select: { name: true } },
        items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
      },
    });
    if (!transfer) return err("Stock transfer not found", 404);
    return ok(transfer);
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/inventory/transfers/[id] — Advance the transfer
// Body: { status: "IN_TRANSIT" | "RECEIVED" | "CANCELLED" }
//
//   PENDING    -> IN_TRANSIT  : stock leaves the source branch (TRANSFER_OUT)
//   IN_TRANSIT -> RECEIVED    : stock lands at the destination (TRANSFER_IN)
//   PENDING    -> CANCELLED   : nothing moved, just close it
//   IN_TRANSIT -> CANCELLED   : goods return to the source branch
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const next: StockTransferStatus = body.status;
    if (!["IN_TRANSIT", "RECEIVED", "CANCELLED"].includes(next)) {
      return err("Validation failed", 422, {
        status: ["status must be IN_TRANSIT, RECEIVED or CANCELLED"],
      });
    }

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!transfer) return err("Stock transfer not found", 404);

    const current = transfer.status;
    const allowed =
      (current === "PENDING" && (next === "IN_TRANSIT" || next === "CANCELLED")) ||
      (current === "IN_TRANSIT" && (next === "RECEIVED" || next === "CANCELLED"));
    if (!allowed) {
      return err(`Cannot move a ${current} transfer to ${next}`, 409);
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        if (current === "PENDING" && next === "IN_TRANSIT") {
          // Leaving the source branch.
          await applyStockMovement(tx, {
            productId: item.productId,
            branchId: transfer.fromBranchId,
            delta: -item.quantity,
            type: "TRANSFER_OUT",
            refId: transfer.id,
            notes: `Transfer ${transfer.transferNo}`,
            performedBy: user.userId,
          });
        } else if (current === "IN_TRANSIT" && next === "RECEIVED") {
          // Arriving at the destination branch.
          await applyStockMovement(tx, {
            productId: item.productId,
            branchId: transfer.toBranchId,
            delta: item.quantity,
            type: "TRANSFER_IN",
            refId: transfer.id,
            notes: `Transfer ${transfer.transferNo}`,
            performedBy: user.userId,
          });
        } else if (current === "IN_TRANSIT" && next === "CANCELLED") {
          // Cancelled mid-flight: put the goods back where they came from.
          await applyStockMovement(tx, {
            productId: item.productId,
            branchId: transfer.fromBranchId,
            delta: item.quantity,
            type: "TRANSFER_IN",
            refId: transfer.id,
            notes: `Transfer ${transfer.transferNo} cancelled — returned to source`,
            performedBy: user.userId,
          });
        }
      }

      return tx.stockTransfer.update({
        where: { id },
        data: {
          status: next,
          ...(next === "IN_TRANSIT" ? { sentAt: new Date(), approvedBy: user.userId } : {}),
          ...(next === "RECEIVED" ? { receivedAt: new Date() } : {}),
        },
        include: { items: true },
      });
    });

    return ok(updated, `Transfer ${next.toLowerCase().replace("_", " ")}`);
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return err("Insufficient stock at the source branch", 422, {
        items: [`Available quantity is ${e.available}`],
      });
    }
    return err("Internal server error", 500);
  }
}
