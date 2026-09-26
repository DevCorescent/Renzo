// ============================================================================
// MODULE : Worker Work History
// ROUTE  : /api/v1/admin/workers/[id]/work-history
//
// GET — paginated list of all appointments a worker was assigned to
//
// ACCESS: BRANCH_ADMIN, OWNER, SUPER_ADMIN
// ============================================================================

import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { branchWhere, requireBranchScope } from "@/lib/branch-scope";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";

const ROLES = ["BRANCH_ADMIN", "OWNER", "SUPER_ADMIN"] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user, new URL(req.url));
  if (scopeError) return scopeError;

  const { id: workerId } = await params;
  const url = new URL(req.url);
  const { page, limit, skip } = parsePagination(url);
  const statusFilter = url.searchParams.get("status");

  try {
    const where: Prisma.AppointmentWhereInput = {
      workerId,
      ...branchWhere(scope),
      ...(statusFilter ? { status: statusFilter as Prisma.AppointmentWhereInput["status"] } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        orderBy: [{ appointmentDate: "desc" }, { startTime: "desc" }],
        skip,
        take: limit,
        select: {
          id: true,
          appointmentNo: true,
          appointmentDate: true,
          startTime: true,
          status: true,
          totalAmount: true,
          discountAmount: true,
          customer: { select: { firstName: true, lastName: true, phone: true } },
          branch: { select: { name: true } },
          services: {
            select: {
              service: { select: { name: true } },
              price: true,
              workerId: true,
            },
          },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    const items = rows.map((r) => ({
      id: r.id,
      appointmentNo: r.appointmentNo,
      appointmentDate: r.appointmentDate,
      startTime: r.startTime,
      status: r.status,
      totalAmount: Number(r.totalAmount),
      discountAmount: Number(r.discountAmount ?? 0),
      customerName: `${r.customer?.firstName ?? ""} ${r.customer?.lastName ?? ""}`.trim() || "Customer",
      customerPhone: r.customer?.phone ?? null,
      branchName: r.branch?.name ?? "",
      services: r.services
        .filter((s) => !s.workerId || s.workerId === workerId)
        .map((s) => ({ name: s.service.name, price: Number(s.price) })),
    }));

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
