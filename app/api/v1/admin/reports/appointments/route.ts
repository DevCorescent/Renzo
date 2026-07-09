import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { parseDateRange } from "@/lib/reports";

// OWNER: Shalmon | MODULE: Appointment Stats Report
// GET /api/v1/admin/reports/appointments?branchId&from&to
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { from, to } = parseDateRange(url);
    const branchId = url.searchParams.get("branchId");

    const grouped = await prisma.appointment.groupBy({
      by: ["status"],
      where: {
        appointmentDate: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });

    const byStatus: Record<string, number> = {};
    let total = 0;
    let revenue = 0;
    for (const g of grouped) {
      byStatus[g.status] = g._count._all;
      total += g._count._all;
      revenue += g._sum.totalAmount ?? 0;
    }

    const completed = byStatus.COMPLETED ?? 0;
    const cancelled = byStatus.CANCELLED ?? 0;
    const noShow = byStatus.NO_SHOW ?? 0;

    return ok({
      from,
      to,
      total,
      pending: byStatus.PENDING ?? 0,
      confirmed: byStatus.CONFIRMED ?? 0,
      checkedIn: byStatus.CHECKED_IN ?? 0,
      started: byStatus.STARTED ?? 0,
      completed,
      cancelled,
      noShow,
      rescheduled: byStatus.RESCHEDULED ?? 0,
      completionRate: total ? Number(((completed / total) * 100).toFixed(1)) : 0,
      cancellationRate: total ? Number((((cancelled + noShow) / total) * 100).toFixed(1)) : 0,
      revenue: Number(revenue.toFixed(2)),
      byStatus,
    });
  } catch {
    return err("Internal server error", 500);
  }
}
