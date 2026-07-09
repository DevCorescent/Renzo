import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

// OWNER: Shalmon | MODULE: Products
// GET /api/v1/admin/inventory/products — List products (search name/sku, filter)
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);
    const categoryId = url.searchParams.get("categoryId");
    const isRetail = url.searchParams.get("isRetail");

    const where: Prisma.ProductWhereInput = {
      ...(categoryId ? { categoryId } : {}),
      ...(isRetail != null ? { isRetail: isRetail === "true" } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { sku: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { category: { select: { name: true } }, supplier: { select: { name: true } } },
      }),
      prisma.product.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/inventory/products — Create a product
export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const name: string = typeof body.name === "string" ? body.name.trim() : "";
    const sku: string = typeof body.sku === "string" ? body.sku.trim() : "";
    const errors: Record<string, string[]> = {};
    if (!name) errors.name = ["Name is required"];
    if (!sku) errors.sku = ["SKU is required"];
    if (Object.keys(errors).length) return err("Validation failed", 422, errors);

    const exists = await prisma.product.findUnique({ where: { sku } });
    if (exists) return err("SKU already exists", 409);

    const product = await prisma.product.create({
      data: {
        name,
        sku,
        categoryId: typeof body.categoryId === "string" ? body.categoryId : null,
        supplierId: typeof body.supplierId === "string" ? body.supplierId : null,
        brand: typeof body.brand === "string" ? body.brand : null,
        description: typeof body.description === "string" ? body.description : null,
        image: typeof body.image === "string" ? body.image : null,
        unit: typeof body.unit === "string" ? body.unit : "ml",
        unitSize: body.unitSize != null ? Number(body.unitSize) : null,
        purchasePrice: Number(body.purchasePrice) || 0,
        sellingPrice: Number(body.sellingPrice) || 0,
        taxPercent: body.taxPercent != null ? Number(body.taxPercent) : 18,
        isRetail: body.isRetail === true,
        isConsumable: body.isConsumable !== false,
        reorderLevel: body.reorderLevel != null ? Number(body.reorderLevel) : 10,
        expiryTracked: body.expiryTracked === true,
      },
    });
    return created(product, "Product created");
  } catch {
    return err("Internal server error", 500);
  }
}
