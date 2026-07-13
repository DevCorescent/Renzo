import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Suppliers
// GET /api/v1/admin/inventory/suppliers/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        products: { select: { id: true, name: true, sku: true }, take: 50 },
        _count: { select: { purchaseOrders: true } },
      },
    });
    if (!supplier) return err("Supplier not found", 404);
    return ok(supplier);
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/inventory/suppliers/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) return err("Supplier not found", 404);

    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.contactPerson === "string" ? { contactPerson: body.contactPerson } : {}),
        ...(typeof body.phone === "string" ? { phone: body.phone } : {}),
        ...(typeof body.email === "string" ? { email: body.email } : {}),
        ...(typeof body.address === "string" ? { address: body.address } : {}),
        ...(typeof body.gstin === "string" ? { gstin: body.gstin } : {}),
        ...(typeof body.bankName === "string" ? { bankName: body.bankName } : {}),
        ...(typeof body.bankAccount === "string" ? { bankAccount: body.bankAccount } : {}),
        ...(typeof body.bankIfsc === "string" ? { bankIfsc: body.bankIfsc } : {}),
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      },
    });
    return ok(supplier, "Supplier updated");
  } catch {
    return err("Internal server error", 500);
  }
}

// DELETE /api/v1/admin/inventory/suppliers/[id] — Deactivate
// Blocked while purchase orders are still open against this supplier.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) return err("Supplier not found", 404);

    const openOrders = await prisma.purchaseOrder.count({
      where: { supplierId: id, status: { in: ["DRAFT", "ORDERED", "PARTIAL"] } },
    });
    if (openOrders > 0) {
      return err(`Cannot deactivate — ${openOrders} open purchase order(s)`, 409);
    }

    await prisma.supplier.update({ where: { id }, data: { isActive: false } });
    return ok(null, "Supplier deactivated");
  } catch {
    return err("Internal server error", 500);
  }
}
