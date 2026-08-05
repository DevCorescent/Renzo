import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, branchWhere } from "@/lib/branch-scope";
import prisma from "@/lib/db";
import { parseDateRange, bucketKey } from "@/lib/reports";

// OWNER: Shalmon | MODULE: Revenue Report
// GET /api/v1/admin/reports/revenue?branchId&from&to&groupBy=day|week|month
//
// BRANCH SCOPE: every role admitted here is global today, so ?branchId= still
// narrows exactly as before. It goes through requireBranchScope anyway, so the
// day ACCOUNTANT is reclassified as branch-scoped this route follows without
// anyone having to remember it.
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "ACCOUNTANT");
  if (error) return error;

  const url = new URL(req.url);
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  try {
    const { from, to } = parseDateRange(url);
    const groupBy = url.searchParams.get("groupBy") ?? "day";

    const invoices = await prisma.invoice.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        status: { not: "CANCELLED" },
        ...branchWhere(scope),
      },
      select: { createdAt: true, totalAmount: true, paidAmount: true },
    });

    const buckets = new Map<string, { revenue: number; paid: number; count: number }>();
    let total = 0;
    let paidTotal = 0;
    for (const inv of invoices) {
      const key = bucketKey(inv.createdAt, groupBy);
      const b = buckets.get(key) ?? { revenue: 0, paid: 0, count: 0 };
      b.revenue += inv.totalAmount;
      b.paid += inv.paidAmount;
      b.count += 1;
      buckets.set(key, b);
      total += inv.totalAmount;
      paidTotal += inv.paidAmount;
    }

    const labels = [...buckets.keys()].sort();
    return ok({
      groupBy,
      from,
      to,
      labels,
      revenue: labels.map((l) => Number(buckets.get(l)!.revenue.toFixed(2))),
      paid: labels.map((l) => Number(buckets.get(l)!.paid.toFixed(2))),
      count: labels.map((l) => buckets.get(l)!.count),
      total: Number(total.toFixed(2)),
      paidTotal: Number(paidTotal.toFixed(2)),
      outstanding: Number((total - paidTotal).toFixed(2)),
      invoiceCount: invoices.length,
    });
  } catch {
    return err("Internal server error", 500);
  }
}
