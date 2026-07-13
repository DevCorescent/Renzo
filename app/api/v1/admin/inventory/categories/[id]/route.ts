import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Product Categories
// PATCH /api/v1/admin/inventory/categories/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const existing = await prisma.productCategory.findUnique({ where: { id } });
    if (!existing) return err("Category not found", 404);

    const category = await prisma.productCategory.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name.trim() } : {}),
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      },
    });
    return ok(category, "Category updated");
  } catch {
    return err("Internal server error", 500);
  }
}

// DELETE /api/v1/admin/inventory/categories/[id] — Deactivate
// Blocked while products still reference it.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const existing = await prisma.productCategory.findUnique({ where: { id } });
    if (!existing) return err("Category not found", 404);

    const productCount = await prisma.product.count({ where: { categoryId: id, isActive: true } });
    if (productCount > 0) {
      return err(`Cannot deactivate — ${productCount} active product(s) use this category`, 409);
    }

    await prisma.productCategory.update({ where: { id }, data: { isActive: false } });
    return ok(null, "Category deactivated");
  } catch {
    return err("Internal server error", 500);
  }
}
