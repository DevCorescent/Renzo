import { NextRequest } from "next/server";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { err, paginated } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Appointments
// ROUTE  : /api/v1/worker/appointments
//
// METHOD
// GET - Own today's and upcoming appointments
//
// ACCESS
// WORKER
//
// VERIFY: assumes AuthUser carries `workerId` (mirroring how `customerId`
// is used in the customer-side routes). If workers are looked up via a
// separate WorkerProfile.userId relation instead, this needs a query to
// resolve workerId from user.userId first.
// ============================================================================

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function utcDayRange(dateStr?: string): [Date, Date] {
  const base = dateStr ?? new Date().toISOString().slice(0, 10);
  const start = new Date(`${base}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return [start, end];
}

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
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
    const appointmentDate = url.searchParams.get("appointmentDate");
    const scope = url.searchParams.get("scope"); // "today" | "upcoming" | "all"

    if (!user.workerId) {
      return err("Your account is not linked to a worker profile", 403);
    }

    const where: Prisma.AppointmentWhereInput = {
      workerId: user.workerId,
    };

    // ------------------------------------------------------------------------
    // Search — by appointment number or customer name/phone.
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
    // Status filter
    // ------------------------------------------------------------------------

    if (status && Object.values(AppointmentStatus).includes(status as AppointmentStatus)) {
      where.status = status as AppointmentStatus;
    }

    // ------------------------------------------------------------------------
    // Date scoping
    //   - explicit appointmentDate=YYYY-MM-DD → that single day
    //   - scope=today → today only
    //   - scope=all → no date filter
    //   - default (no params) → today onward ("today's and upcoming")
    // ------------------------------------------------------------------------

    if (appointmentDate) {
      if (!DATE_RE.test(appointmentDate)) {
        return err("Invalid appointmentDate format. Use YYYY-MM-DD");
      }
      const [start, end] = utcDayRange(appointmentDate);
      where.appointmentDate = { gte: start, lt: end };
    } else if (scope === "today") {
      const [start, end] = utcDayRange();
      where.appointmentDate = { gte: start, lt: end };
    } else if (scope !== "all") {
      const [start] = utcDayRange();
      where.appointmentDate = { gte: start };
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
        include: {
          customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
          branch: { select: { id: true, name: true } },
          services: {
            include: {
              service: { select: { id: true, name: true } },
              variant: { select: { id: true, name: true } },
            },
          },
          addOns: { include: { addOn: { select: { id: true, name: true } } } },
          packages: { include: { package: { select: { id: true, name: true } } } },
          _count: { select: { services: true, addOns: true, packages: true } },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    return paginated(appointments, total, page, limit, "Appointments fetched successfully");
  } catch (error) {
    console.error("GET Worker Appointments Error:", error);
    return err("Internal server error", 500);
  }
}