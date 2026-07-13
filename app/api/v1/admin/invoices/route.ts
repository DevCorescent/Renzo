import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

// OWNER: Shalmon | MODULE: Invoices
// GET /api/v1/admin/invoices — List invoices (paginated, filterable)
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN", "ACCOUNTANT");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);
    const status = url.searchParams.get("status");
    const branchId = url.searchParams.get("branchId");
    const customerId = url.searchParams.get("customerId");

    const where: Prisma.InvoiceWhereInput = {
      ...(status ? { status: status as Prisma.InvoiceWhereInput["status"] } : {}),
      ...(branchId ? { branchId } : {}),
      ...(customerId ? { customerId } : {}),
      ...(search ? { invoiceNo: { contains: search, mode: "insensitive" } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true, payments: true } } },
      }),
      prisma.invoice.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
