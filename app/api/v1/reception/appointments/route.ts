import { NextRequest } from "next/server";
import { AppointmentStatus, BookingSource, PaymentStatus, Prisma } from "@prisma/client";

import { created, err, paginated } from "@/lib/response";
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
//
// Resolves the customer by phone (auto-registers a CUSTOMER account if new),
// prices each service at the branch rate, computes the end time from the total
// duration, and books an appointment tagged as WALK_IN.
//
// ACCESS: RECEPTIONIST, BRANCH_ADMIN (own branch) · SUPER_ADMIN, OWNER (any)
// ============================================================================

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function addMinutes(start: string, mins: number): string {
  const [h, m] = start.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function walkInAppointmentNo() {
  const now = new Date();
  const date =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");
  return `APT-${date}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(
    req,
    "RECEPTIONIST",
    "BRANCH_ADMIN",
    "SUPER_ADMIN",
    "OWNER"
  );
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid request body");

    const {
      customerPhone,
      customerName,
      serviceIds,
      workerId,
      appointmentDate,
      startTime,
      notes,
    } = body as Record<string, unknown>;

    // ── Branch resolution ────────────────────────────────────────────────────
    let branchId: string | undefined;
    if (user.userType === "RECEPTIONIST" || user.userType === "BRANCH_ADMIN") {
      if (!isNonEmptyString(user.branchId)) {
        return err("Your account is not assigned to a branch", 403);
      }
      branchId = user.branchId;
    } else {
      branchId = isNonEmptyString(body.branchId) ? (body.branchId as string) : undefined;
      if (!branchId) return err("branchId is required", 422);
    }

    // ── Validation ───────────────────────────────────────────────────────────
    const phone = isNonEmptyString(customerPhone) ? customerPhone.trim() : "";
    if (!phone) return err("Customer phone is required");

    if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
      return err("At least one service is required");
    }
    if (!serviceIds.every((s) => isNonEmptyString(s))) {
      return err("One or more service entries are malformed");
    }
    const uniqueServiceIds = [...new Set(serviceIds as string[])];

    if (!isNonEmptyString(appointmentDate)) return err("Appointment date is required");
    const parsedDate = new Date(appointmentDate as string);
    if (Number.isNaN(parsedDate.getTime())) return err("Invalid appointment date");

    if (!isNonEmptyString(startTime) || !TIME_RE.test((startTime as string).trim())) {
      return err("Start time must be in HH:mm format (e.g. 09:00)");
    }
    const start = (startTime as string).trim();

    // ── Branch must exist and be active ──────────────────────────────────────
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, isActive: true },
    });
    if (!branch || !branch.isActive) return err("Branch not found", 404);

    // ── Services — validate + price at the branch rate ───────────────────────
    const dbServices = await prisma.service.findMany({
      where: { id: { in: uniqueServiceIds }, isActive: true },
      select: {
        id: true,
        duration: true,
        basePrice: true,
        branchPricings: {
          where: { branchId, isActive: true },
          select: { price: true },
        },
      },
    });
    if (dbServices.length !== uniqueServiceIds.length) {
      return err("One or more services are invalid or unavailable at this branch");
    }

    let totalDuration = 0;
    let subtotal = 0;
    const serviceRows = dbServices.map((s) => {
      const price = s.branchPricings[0]?.price ?? Number(s.basePrice);
      totalDuration += s.duration;
      subtotal += Number(price);
      return {
        serviceId: s.id,
        price: Number(price),
        duration: s.duration,
        status: AppointmentStatus.PENDING,
      };
    });
    const endTime = addMinutes(start, totalDuration);

    // ── Worker (optional) — must belong to branch + be qualified ─────────────
    let resolvedWorkerId: string | null = null;
    if (isNonEmptyString(workerId)) {
      const worker = await prisma.workerProfile.findUnique({
        where: { id: workerId as string },
        select: {
          id: true,
          isActive: true,
          branches: { where: { branchId, isActive: true }, select: { id: true } },
        },
      });
      if (!worker || !worker.isActive) return err("Worker not found", 404);
      if (worker.branches.length === 0) {
        return err("This worker is not assigned to the selected branch", 422);
      }
      const qualified = await prisma.workerService.count({
        where: { workerId: worker.id, serviceId: { in: uniqueServiceIds }, isActive: true },
      });
      if (qualified !== uniqueServiceIds.length) {
        return err("This stylist does not offer one or more of the selected services", 422);
      }
      // Overlap guard.
      const overlapping = await prisma.appointment.count({
        where: {
          workerId: worker.id,
          appointmentDate: parsedDate,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          startTime: { lt: endTime },
          endTime: { gt: start },
        },
      });
      if (overlapping > 0) {
        return err("The selected time slot is not available for this worker", 409);
      }
      resolvedWorkerId = worker.id;
    }

    // ── Customer — find by phone, else auto-register ─────────────────────────
    const nameInput = isNonEmptyString(customerName) ? customerName.trim() : "";
    const nameParts = nameInput.split(/\s+/).filter(Boolean);

    let account = await prisma.user.findFirst({
      where: { phone },
      select: { id: true, customerProfile: { select: { id: true } } },
    });

    let customerId: string;
    if (account?.customerProfile) {
      customerId = account.customerProfile.id;
    } else if (account) {
      // A non-customer user (e.g. staff) owns this phone — can't book them.
      return err("This phone number belongs to a non-customer account", 409);
    } else {
      const createdCustomer = await prisma.user.create({
        data: {
          phone,
          userType: "CUSTOMER",
          isVerified: false,
          customerProfile: {
            create: {
              firstName: nameParts[0] || "Walk-in",
              lastName: nameParts.slice(1).join(" ") || null,
              phone,
            },
          },
        },
        select: { customerProfile: { select: { id: true } } },
      });
      customerId = createdCustomer.customerProfile!.id;
    }

    // ── Branch holiday check ─────────────────────────────────────────────────
    const dateStr = parsedDate.toISOString().slice(0, 10);
    const holiday = await prisma.branchHoliday.findFirst({
      where: { branchId, date: new Date(dateStr) },
    });
    if (holiday) {
      return err(`The branch is closed on this date${holiday.reason ? `: ${holiday.reason}` : ""}`, 409);
    }

    // ── Create ───────────────────────────────────────────────────────────────
    const appointment = await prisma.appointment.create({
      data: {
        appointmentNo: walkInAppointmentNo(),
        customerId,
        branchId,
        workerId: resolvedWorkerId,
        status: AppointmentStatus.CONFIRMED,
        source: BookingSource.WALK_IN,
        appointmentDate: parsedDate,
        startTime: start,
        endTime,
        totalDuration,
        subtotal,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: subtotal,
        paidAmount: 0,
        paymentStatus: PaymentStatus.PENDING,
        notes: isNonEmptyString(notes) ? notes.trim() : undefined,
        services: {
          create: serviceRows.map((r) => ({ ...r, workerId: resolvedWorkerId })),
        },
      },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    });

    return created(appointment, "Walk-in appointment booked successfully");
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return err("Appointment number clash, please retry", 409);
      if (e.code === "P2003") return err("Invalid branch, worker, or service reference", 400);
    }
    console.error("POST Reception Appointment Error:", e);
    return err("Internal server error", 500);
  }
}