import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

// OWNER: Shalmon | MODULE: Suppliers
// GET /api/v1/admin/inventory/suppliers — List suppliers
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);
    const isActive = url.searchParams.get("isActive");

    const where: Prisma.SupplierWhereInput = {
      ...(isActive != null ? { isActive: isActive === "true" } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: "asc" },
        include: { _count: { select: { products: true, purchaseOrders: true } } },
      }),
      prisma.supplier.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/inventory/suppliers — Create a supplier
export async function POST(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const name: string = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return err("Validation failed", 422, { name: ["Name is required"] });

    const supplier = await prisma.supplier.create({
      data: {
        name,
        contactPerson: typeof body.contactPerson === "string" ? body.contactPerson : null,
        phone: typeof body.phone === "string" ? body.phone : null,
        email: typeof body.email === "string" ? body.email : null,
        address: typeof body.address === "string" ? body.address : null,
        gstin: typeof body.gstin === "string" ? body.gstin : null,
        bankName: typeof body.bankName === "string" ? body.bankName : null,
        bankAccount: typeof body.bankAccount === "string" ? body.bankAccount : null,
        bankIfsc: typeof body.bankIfsc === "string" ? body.bankIfsc : null,
      },
    });
    return created(supplier, "Supplier created");
  } catch {
    return err("Internal server error", 500);
  }
}
