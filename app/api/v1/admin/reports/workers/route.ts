import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { parseDateRange } from "@/lib/reports";

// OWNER: Shalmon | MODULE: Worker Performance Report
// GET /api/v1/admin/reports/workers?branchId&from&to
export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url);
    const { from, to } = parseDateRange(url);
    const branchId = url.searchParams.get("branchId");

    const baseWhere = {
      appointmentDate: { gte: from, lte: to },
      workerId: { not: null },
      ...(branchId ? { branchId } : {}),
    };

    const [grouped, completedGrouped] = await Promise.all([
      prisma.appointment.groupBy({
        by: ["workerId"],
        where: baseWhere,
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      prisma.appointment.groupBy({
        by: ["workerId"],
        where: { ...baseWhere, status: "COMPLETED" },
        _count: { _all: true },
      }),
    ]);

    const completedMap = new Map(completedGrouped.map((g) => [g.workerId, g._count._all]));
    const workerIds = grouped.map((g) => g.workerId).filter((x): x is string => !!x);

    const [workers, ratings] = await Promise.all([
      prisma.workerProfile.findMany({
        where: { id: { in: workerIds } },
        select: { id: true, firstName: true, lastName: true, displayName: true },
      }),
      prisma.ratingSummary.findMany({
        where: { workerId: { in: workerIds } },
        select: { workerId: true, averageRating: true, totalReviews: true },
      }),
    ]);

    const nameMap = new Map(
      workers.map((w) => [w.id, w.displayName || `${w.firstName} ${w.lastName}`])
    );
    const ratingMap = new Map(ratings.map((r) => [r.workerId, r]));

    const rows = grouped
      .map((g) => {
        const id = g.workerId as string;
        const totalAppointments = g._count._all;
        const completed = completedMap.get(id) ?? 0;
        const rating = ratingMap.get(id);
        return {
          workerId: id,
          name: nameMap.get(id) ?? "Unknown",
          totalAppointments,
          completed,
          completionRate: totalAppointments
            ? Number(((completed / totalAppointments) * 100).toFixed(1))
            : 0,
          totalRevenue: Number((g._sum.totalAmount ?? 0).toFixed(2)),
          avgRating: rating?.averageRating ?? 0,
          totalReviews: rating?.totalReviews ?? 0,
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    return paginated(rows.slice(skip, skip + limit), rows.length, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
