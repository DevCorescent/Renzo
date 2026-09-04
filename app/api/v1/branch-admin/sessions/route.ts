// ============================================================================
// MODULE : Today's Sessions (branch admin walk-in board)
// ROUTE  : GET /api/v1/branch-admin/sessions?date=YYYY-MM-DD
//
// Returns all non-cancelled appointments for the branch on the given date
// with enough data to show on the sessions board and pre-populate the
// walk-in console when a session is resumed.
// ============================================================================

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { ok, err } from "@/lib/response";
import prisma from "@/lib/db";

const ROLES = ["BRANCH_ADMIN", "OWNER", "SUPER_ADMIN", "RECEPTIONIST"] as const;

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;

  const branchId = user.branchId;
  if (!branchId) return err("No branch associated with your account", 403);

  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const dateObj = new Date(dateStr + "T00:00:00");
  if (isNaN(dateObj.getTime())) return err("Invalid date", 400);

  const appointments = await prisma.appointment.findMany({
    where: {
      branchId,
      appointmentDate: { gte: dateObj, lte: new Date(dateStr + "T23:59:59") },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    orderBy: { startTime: "asc" },
    select: {
      id: true,
      appointmentNo: true,
      status: true,
      startTime: true,
      source: true,
      customer: {
        select: {
          id: true, firstName: true, lastName: true,
          phone: true, email: true, totalVisits: true,
        },
      },
      worker: {
        select: { id: true, firstName: true, lastName: true },
      },
      services: {
        select: {
          serviceId: true,
          price: true,
          duration: true,
          service: { select: { name: true } },
        },
      },
      invoice: {
        select: {
          id: true, invoiceNo: true,
          totalAmount: true, balanceDue: true, status: true,
        },
      },
    },
  });

  const sessions = appointments.map((a) => ({
    id: a.id,
    appointmentNo: a.appointmentNo,
    status: a.status,
    startTime: a.startTime,
    source: a.source,
    customer: {
      id: a.customer.id,
      firstName: a.customer.firstName,
      lastName: a.customer.lastName,
      phone: a.customer.phone,
      email: a.customer.email,
      totalVisits: a.customer.totalVisits,
    },
    workerId: a.worker?.id ?? null,
    workerName: a.worker ? `${a.worker.firstName} ${a.worker.lastName}`.trim() : null,
    serviceNames: a.services.map((s) => s.service.name).join(", ") || "—",
    serviceCount: a.services.length,
    invoice: a.invoice
      ? {
          id: a.invoice.id,
          invoiceNo: a.invoice.invoiceNo,
          totalAmount: a.invoice.totalAmount,
          balanceDue: a.invoice.balanceDue,
          status: a.invoice.status,
        }
      : null,
  }));

  return ok(sessions);
}
