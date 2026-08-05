// ============================================================================
// MODULE : Customers — instant search
// ROUTE  : /api/v1/admin/customers/search?q=
//
// A deliberately SMALL, fast lookup for type-ahead: the front desk types a phone
// or a name while the customer is standing there, and needs a handful of matches
// in one round trip — not the full paginated list payload with memberships,
// branches and visit counts attached.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN, RECEPTIONIST.
// ============================================================================

import { NextRequest } from "next/server";
import { err, ok } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import prisma from "@/lib/db";
import { buildCustomerWhere, parseCustomerFilters } from "@/lib/customer-service";

const MAX_RESULTS = 10;

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN",
    "RECEPTIONIST"
  );
  if (error) return error;

  const url = new URL(req.url);
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  try {
    const q = url.searchParams.get("q")?.trim() ?? "";
    // One character matches most of the book; make the caller be specific.
    if (q.length < 2) return ok({ items: [] });

    // Reuse the list's own where-builder so search and list can never disagree
    // about which customers a role is allowed to see.
    url.searchParams.set("search", q);
    const where = buildCustomerWhere(parseCustomerFilters(url), scope);

    const items = await prisma.customer.findMany({
      where,
      take: MAX_RESULTS,
      orderBy: [{ totalVisits: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        totalVisits: true,
        customerType: true,
        isManualEntry: true,
        branch: { select: { id: true, name: true } },
        memberships: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { endDate: "desc" },
          select: { plan: { select: { name: true, tier: true } } },
        },
      },
    });

    return ok({ items });
  } catch {
    return err("Internal server error", 500);
  }
}
