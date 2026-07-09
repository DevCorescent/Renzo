import { NextRequest } from "next/server";
import { ok, created, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Product Categories
// GET /api/v1/admin/inventory/categories — List product categories
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const categories = await prisma.productCategory.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
    return ok(categories);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/inventory/categories — Create a category
export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const name: string = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return err("Validation failed", 422, { name: ["Name is required"] });

    const exists = await prisma.productCategory.findUnique({ where: { name } });
    if (exists) return err("Category already exists", 409);

    const category = await prisma.productCategory.create({ data: { name } });
    return created(category, "Category created");
  } catch {
    return err("Internal server error", 500);
  }
}
