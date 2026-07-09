import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Products
// GET /api/v1/admin/inventory/products/[id] — Product with per-branch stock
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true, supplier: true, stocks: true },
    });
    if (!product) return err("Product not found", 404);
    return ok(product);
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/inventory/products/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return err("Product not found", 404);

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.brand === "string" ? { brand: body.brand } : {}),
        ...(typeof body.description === "string" ? { description: body.description } : {}),
        ...(typeof body.image === "string" ? { image: body.image } : {}),
        ...(typeof body.categoryId === "string" ? { categoryId: body.categoryId } : {}),
        ...(typeof body.supplierId === "string" ? { supplierId: body.supplierId } : {}),
        ...(body.purchasePrice != null ? { purchasePrice: Number(body.purchasePrice) } : {}),
        ...(body.sellingPrice != null ? { sellingPrice: Number(body.sellingPrice) } : {}),
        ...(body.taxPercent != null ? { taxPercent: Number(body.taxPercent) } : {}),
        ...(body.reorderLevel != null ? { reorderLevel: Number(body.reorderLevel) } : {}),
        ...(typeof body.isRetail === "boolean" ? { isRetail: body.isRetail } : {}),
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      },
    });
    return ok(product, "Product updated");
  } catch {
    return err("Internal server error", 500);
  }
}

// DELETE /api/v1/admin/inventory/products/[id] — Soft-delete (deactivate)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return err("Product not found", 404);
    await prisma.product.update({ where: { id }, data: { isActive: false } });
    return ok(null, "Product deactivated");
  } catch {
    return err("Internal server error", 500);
  }
}
