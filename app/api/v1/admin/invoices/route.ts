import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, branchWhere } from "@/lib/branch-scope";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

// OWNER: Shalmon | MODULE: Invoices
// GET /api/v1/admin/invoices — List invoices (paginated, filterable)
//
// BRANCH SCOPE: a branch admin sees their own branch's invoices and nothing
// else. Taking the branch from ?branchId= meant omitting it listed every
// branch's takings, and naming another branch read that branch's.
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN", "ACCOUNTANT");
  if (error) return error;

  const url = new URL(req.url);
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  try {
    const { page, limit, skip, search } = parsePagination(url);
    const status = url.searchParams.get("status");
    const customerId = url.searchParams.get("customerId");

    const where: Prisma.InvoiceWhereInput = {
      ...branchWhere(scope),
      ...(status ? { status: status as Prisma.InvoiceWhereInput["status"] } : {}),
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
