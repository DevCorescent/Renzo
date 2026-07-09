import { NextRequest } from "next/server";
import { AppointmentStatus, PaymentStatus, Prisma } from "@prisma/client";

import { err, paginated } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Reception Appointments
// ROUTE  : /api/v1/reception/appointments
//
// METHODS
// GET - Today's Appointment List
//
// ACCESS
// RECEPTIONIST, BRANCH_ADMIN, SUPER_ADMIN, OWNER
// ============================================================================

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function utcDayRange(dateStr?: string): [Date, Date] {
  const base = dateStr ?? new Date().toISOString().slice(0, 10);
  const start = new Date(`${base}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return [start, end];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(
    req,
    "RECEPTIONIST",
    "BRANCH_ADMIN",
    "SUPER_ADMIN",
    "OWNER"
  );

  if (error) return error;

  try {
    const url = new URL(req.url);

    const page = Math.max(Number(url.searchParams.get("page") ?? "1"), 1);
    const limit = Math.min(
      Math.max(Number(url.searchParams.get("limit") ?? "10"), 1),
      100
    );
    const skip = (page - 1) * limit;

    const search = url.searchParams.get("search")?.trim();
    const status = url.searchParams.get("status");
    const paymentStatus = url.searchParams.get("paymentStatus");
    const workerId = url.searchParams.get("workerId");
    const branchId = url.searchParams.get("branchId");
    const appointmentDate = url.searchParams.get("appointmentDate");

    const where: Prisma.AppointmentWhereInput = {};

    // ------------------------------------------------------------------------
    // Branch Restriction
    // ------------------------------------------------------------------------

    if (user.userType === "RECEPTIONIST" || user.userType === "BRANCH_ADMIN") {
      if (!isNonEmptyString(user.branchId)) {
        return err("Your account is not assigned to a branch", 403);
      }
      where.branchId = user.branchId;
    } else if (branchId) {
      where.branchId = branchId;
    }

    // ------------------------------------------------------------------------
    // Search
    // ------------------------------------------------------------------------
    if (search) {
      where.OR = [
        { appointmentNo: { contains: search, mode: "insensitive" } },
        { customer: { is: { firstName: { contains: search, mode: "insensitive" } } } },
        { customer: { is: { lastName: { contains: search, mode: "insensitive" } } } },
        { customer: { is: { phone: { contains: search } } } },
      ];
    }

    // ------------------------------------------------------------------------
    // Filters
    // ------------------------------------------------------------------------

    if (status && Object.values(AppointmentStatus).includes(status as AppointmentStatus)) {
      where.status = status as AppointmentStatus;
    }

    if (
      paymentStatus &&
      Object.values(PaymentStatus).includes(paymentStatus as PaymentStatus)
    ) {
      where.paymentStatus = paymentStatus as PaymentStatus;
    }

    if (workerId) {
      where.workerId = workerId;
    }

    // ------------------------------------------------------------------------
    // Appointment Date
    // ------------------------------------------------------------------------

    if (appointmentDate) {
      if (!DATE_RE.test(appointmentDate)) {
        return err("Invalid appointmentDate format. Use YYYY-MM-DD");
      }
      const [start, end] = utcDayRange(appointmentDate);
      where.appointmentDate = { gte: start, lt: end };
    } else {
      const [start, end] = utcDayRange();
      where.appointmentDate = { gte: start, lt: end };
    }

    // ------------------------------------------------------------------------
    // Fetch Appointments
    // ------------------------------------------------------------------------

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ startTime: "asc" }, { createdAt: "desc" }],
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
          branch: { select: { id: true, name: true } },
          worker: {
            select: { id: true, firstName: true, lastName: true, profilePhoto: true },
          },
          services: {
            include: {
              service: { select: { id: true, name: true } },
              variant: { select: { id: true, name: true } },
            },
          },
          packages: { include: { package: { select: { id: true, name: true } } } },
          addOns: { include: { addOn: { select: { id: true, name: true } } } },
          _count: { select: { services: true, packages: true, addOns: true } },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    return paginated(appointments, total, page, limit, "Appointments fetched successfully");
  } catch (error) {
    console.error("GET Reception Appointments Error:", error);
    return err("Internal server error", 500);
  }
}

// ============================================================================
// POST /api/v1/reception/appointments — Create Walk-in Appointment
// Still not included — send it when ready.
// ============================================================================