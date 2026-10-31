// GET /api/v1/admin/memberships/customers
// Lists all CustomerMembership records for the branch. Branch-scoped for
// BRANCH_ADMIN; global for SUPER_ADMIN/OWNER.
// Query params: search, status, page, limit

import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, branchWhere } from "@/lib/branch-scope";
import prisma from "@/lib/db";
import type { MembershipStatus, Prisma } from "@prisma/client";

const STATUSES: MembershipStatus[] = ["ACTIVE", "EXPIRED", "FROZEN", "CANCELLED"];

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const { scope, error: scopeErr } = requireBranchScope(user);
  if (scopeErr) return scopeErr;

  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);
    const status = url.searchParams.get("status");

    // Resolve branch filter via customer.branchId
    const scopeWhere = branchWhere(scope!);
    const branchFilter: Prisma.CustomerMembershipWhereInput =
      scope?.isGlobal
        ? {}
        : scope?.branchId
          ? { customer: { branchId: scope.branchId } }
          : {};

    const where: Prisma.CustomerMembershipWhereInput = {
      ...branchFilter,
      ...(status && STATUSES.includes(status as MembershipStatus)
        ? { status: status as MembershipStatus }
        : {}),
      ...(search
        ? {
            customer: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { phone: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.customerMembership.findMany({
        where,
        skip,
        take: limit,
        orderBy: { purchasedAt: "desc" },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          autoRenew: true,
          purchasedAt: true,
          plan: { select: { id: true, name: true, tier: true } },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
            },
          },
        },
      }),
      prisma.customerMembership.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
