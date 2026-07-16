// ============================================================================
// OWNER  : Gauransh
// MODULE : Membership Plan — Customers
// FLOW   : List every customer subscribed to one plan, with backend search, status
//          filter and pagination, for the plan's customer drawer.
// ACCESS : SUPER_ADMIN, OWNER (same as the plan routes).
// BACKEND: Reuses CustomerMembership + Customer (+ LoyaltyAccount) only. There was
//          no admin endpoint to read a plan's subscribers, so this is the one
//          missing READ — it duplicates no existing route or logic.
// ============================================================================

import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { MembershipStatus, Prisma } from "@prisma/client";

const STATUSES: MembershipStatus[] = ["ACTIVE", "EXPIRED", "FROZEN", "CANCELLED"];

// GET /api/v1/admin/memberships/plans/[id]/customers?search&status&page&limit
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);
    const status = url.searchParams.get("status");

    // Scope to this plan; search runs THROUGH the customer relation (name/phone/email)
    // so it can only narrow within the plan, never widen.
    const where: Prisma.CustomerMembershipWhereInput = {
      planId: id,
      ...(status && STATUSES.includes(status as MembershipStatus) ? { status: status as MembershipStatus } : {}),
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
          plan: { select: { name: true, tier: true, branchAccess: true } },
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              profilePhoto: true,
              totalVisits: true,
              totalSpend: true,
              loyaltyAccount: { select: { tier: true } },
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
