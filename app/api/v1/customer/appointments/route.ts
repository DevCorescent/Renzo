import { NextRequest } from "next/server";
import {
  Prisma,
  AppointmentStatus,
  BookingSource,
  PaymentStatus,
} from "@prisma/client";

import { created, err, paginated } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Customer Appointments
// ROUTE  : /api/v1/customer/appointments
//
// METHODS
// GET  - Customer Appointment List
// POST - Customer Book Appointment
//
// ACCESS
// CUSTOMER
// ============================================================================

/* ============================================================================
   Helpers
============================================================================ */

function optionalTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isTimeAfter(end: string, start: string): boolean {
  // Lexicographic comparison only gives correct results for zero-padded
  // 24h "HH:mm" strings — validate the format first so "9:00" vs "10:00"
  // can't silently compare backwards.
  if (!TIME_RE.test(end) || !TIME_RE.test(start)) {
    return false;
  }
  return end > start;
}

function generateAppointmentNumber() {
  const now = new Date();

  const date =
    now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");

  const random = Math.floor(1000 + Math.random() * 9000);

  return `APT-${date}-${random}`;
}

/* ============================================================================
   GET /api/v1/customer/appointments

   Features
   --------
   • Pagination
   • Search
   • Status Filter
   • Payment Status Filter
   • Customer can access ONLY own appointments
============================================================================ */

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
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

    const where: Prisma.AppointmentWhereInput = {
      customerId: user.customerId,
    };

    // ------------------------------------------------------------------------
    // Search
    // ------------------------------------------------------------------------

    if (search) {
      where.appointmentNo = {
        contains: search,
        mode: "insensitive",
      };
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

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ appointmentDate: "desc" }, { startTime: "asc" }],
        include: {
          branch: {
            select: { id: true, name: true, address: true, phone: true },
          },
          worker: {
            select: { id: true, firstName: true, lastName: true, profilePhoto: true },
          },
          services: {
            include: {
              service: { select: { id: true, name: true, image: true } },
              variant: { select: { id: true, name: true } },
            },
          },
          addOns: {
            include: { addOn: { select: { id: true, name: true, price: true } } },
          },
          packages: {
            include: { package: { select: { id: true, name: true, price: true } } },
          },
          _count: {
            select: { services: true, addOns: true, packages: true },
          },
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    return paginated(appointments, total, page, limit, "Appointments fetched successfully");
  } catch (error) {
    console.error("GET Customer Appointments Error:", error);
    return err("Internal server error", 500);
  }
}

/* ============================================================================
   POST /api/v1/customer/appointments

   Books a new appointment for the authenticated customer.
============================================================================ */

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return err("Invalid request body");
    }

    const {
      branchId,
      workerId,
      appointmentDate,
      startTime,
      endTime,
      notes,
      services = [],
      addOns = [],
      packages = [],
    } = body;

    // ------------------------------------------------------------------------
    // Basic Validation
    // ------------------------------------------------------------------------

    if (!isNonEmptyString(branchId)) {
      return err("Branch is required");
    }

    if (!isNonEmptyString(appointmentDate)) {
      return err("Appointment date is required");
    }

    const parsedDate = new Date(appointmentDate);
    if (Number.isNaN(parsedDate.getTime())) {
      return err("Invalid appointment date");
    }

    if (!isNonEmptyString(startTime) || !TIME_RE.test(startTime.trim())) {
      return err("Start time must be in HH:mm format (e.g. 09:00)");
    }

    if (!isNonEmptyString(endTime) || !TIME_RE.test(endTime.trim())) {
      return err("End time must be in HH:mm format (e.g. 10:30)");
    }

    if (!isTimeAfter(endTime.trim(), startTime.trim())) {
      return err("End time must be after start time");
    }

    if (!Array.isArray(services) || services.length === 0) {
      return err("At least one service is required");
    }

    // Every array item must actually be an object with the expected id
    // field — a malformed/null entry would otherwise throw a TypeError
    // during the .map() calls below and surface as a 500.
    const isValidItemArray = (arr: unknown, key: string): boolean =>
      Array.isArray(arr) &&
      arr.every(
        (item) =>
          item !== null &&
          typeof item === "object" &&
          isNonEmptyString((item as Record<string, unknown>)[key])
      );

    if (!isValidItemArray(services, "serviceId")) {
      return err("One or more service entries are malformed");
    }
    if (!isValidItemArray(addOns, "addOnId")) {
      return err("One or more add-on entries are malformed");
    }
    if (!isValidItemArray(packages, "packageId")) {
      return err("One or more package entries are malformed");
    }

    // ------------------------------------------------------------------------
    // Customer Validation
    // ------------------------------------------------------------------------

    const customer = await prisma.customer.findUnique({
      where: { id: user.customerId },
      select: { id: true, isActive: true },
    });

    if (!customer || !customer.isActive) {
      return err("Customer not found", 404);
    }

    // ------------------------------------------------------------------------
    // Branch Validation
    // ------------------------------------------------------------------------

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true, isActive: true },
    });

    if (!branch || !branch.isActive) {
      return err("Branch not found", 404);
    }

    // ------------------------------------------------------------------------
    // Worker Validation (Optional)
    // ------------------------------------------------------------------------

    let worker = null;

    if (isNonEmptyString(workerId)) {
      worker = await prisma.workerProfile.findUnique({
        where: { id: workerId },
        select: { id: true, firstName: true, lastName: true, isActive: true },
      });

      if (!worker || !worker.isActive) {
        return err("Worker not found", 404);
      }

      // TODO (Phase 2): validate worker belongs to selected branch
      // TODO (Phase 2): validate worker can perform selected services
    }

    // ------------------------------------------------------------------------
    // Service Validation
    // ------------------------------------------------------------------------

    const serviceIds: string[] = services.map(
      (service: { serviceId: string }) => service.serviceId
    );

    const uniqueServiceIds = new Set(serviceIds);
    if (uniqueServiceIds.size !== serviceIds.length) {
      return err("Duplicate services are not allowed in a single booking");
    }

    const dbServices = await prisma.service.findMany({
      where: { id: { in: serviceIds }, isActive: true },
      select: { id: true, name: true, basePrice: true, duration: true },
    });

    if (dbServices.length !== serviceIds.length) {
      return err("One or more services are invalid");
    }

    // TODO: this endpoint currently ignores any `variantId` a client might
    // send per service and always prices at service.basePrice. Confirm
    // whether variant-based pricing needs to be wired in here — the GET
    // response includes `variant` per appointment-service, implying the
    // data model supports it even though creation doesn't yet.

    // ------------------------------------------------------------------------
    // Add-on Validation
    // ------------------------------------------------------------------------

    const addOnIds: string[] = addOns.map((item: { addOnId: string }) => item.addOnId);

    const dbAddOns =
      addOnIds.length > 0
        ? await prisma.addOn.findMany({
            where: { id: { in: addOnIds }, isActive: true },
            select: { id: true, name: true, price: true },
          })
        : [];

    if (dbAddOns.length !== addOnIds.length) {
      return err("One or more add-ons are invalid");
    }

    // ------------------------------------------------------------------------
    // Package Validation
    // ------------------------------------------------------------------------

    const packageIds: string[] = packages.map(
      (item: { packageId: string }) => item.packageId
    );

    const dbPackages =
      packageIds.length > 0
        ? await prisma.package.findMany({
            where: { id: { in: packageIds }, isActive: true },
            select: { id: true, name: true, price: true },
          })
        : [];

    if (dbPackages.length !== packageIds.length) {
      return err("One or more packages are invalid");
    }

    // ------------------------------------------------------------------------
    // Calculate Duration & Amount
    // ------------------------------------------------------------------------

    let totalDuration = 0;
    let subtotal = 0;

    // Number(...) wrapping is deliberate: if basePrice/price fields are
    // Prisma Decimal (common for money fields), `+=` on the raw object
    // falls back to string concatenation instead of numeric addition,
    // silently corrupting every total. Number() is a safe no-op if these
    // are already plain numbers.
    const appointmentServices = dbServices.map((service) => {
      totalDuration += service.duration;
      subtotal += Number(service.basePrice);

      return {
        serviceId: service.id,
        workerId: worker?.id ?? null,
        price: Number(service.basePrice),
        duration: service.duration,
        status: AppointmentStatus.PENDING,
      };
    });

    const appointmentAddOns = dbAddOns.map((addOn) => {
      subtotal += Number(addOn.price);
      return { addOnId: addOn.id, price: Number(addOn.price) };
    });

    const appointmentPackages = dbPackages.map((pkg) => {
      subtotal += Number(pkg.price);
      return { packageId: pkg.id, price: Number(pkg.price) };
    });

    // NOTE: taxAmount is hardcoded to 0 here, ignoring service.taxPercent
    // used elsewhere in this codebase — confirm this is deliberate (e.g.
    // tax computed later at invoice generation) rather than an oversight.
    const taxAmount = 0;
    const discountAmount = 0;
    const totalAmount = subtotal + taxAmount - discountAmount;

    // ------------------------------------------------------------------------
    // Generate Appointment Number
    // ------------------------------------------------------------------------

    const appointmentNo = generateAppointmentNumber();

    // TODO (Phase 2): validate slot availability
    // TODO (Phase 2): apply coupon
    // TODO (Phase 2): membership discount
    // TODO (Phase 2): loyalty redemption
    // TODO (Phase 2): wallet payment

    // ------------------------------------------------------------------------
    // Create Appointment
    // ------------------------------------------------------------------------

    const appointment = await prisma.$transaction(async (tx) => {
      const createdAppointment = await tx.appointment.create({
        data: {
          appointmentNo,
          customerId: customer.id,
          branchId,
          workerId: worker?.id ?? null,
          status: AppointmentStatus.PENDING,
          source: BookingSource.ONLINE,
          appointmentDate: parsedDate,
          startTime: startTime.trim(),
          endTime: endTime.trim(),
          totalDuration,
          subtotal,
          taxAmount,
          discountAmount,
          totalAmount,
          paidAmount: 0,
          paymentStatus: PaymentStatus.PENDING,
          notes: optionalTrimmedString(notes),
          services: { create: appointmentServices },
          addOns: { create: appointmentAddOns },
          packages: { create: appointmentPackages },
        },
        include: {
          branch: { select: { id: true, name: true } },
          worker: { select: { id: true, firstName: true, lastName: true } },
          services: { include: { service: { select: { id: true, name: true } } } },
          addOns: { include: { addOn: { select: { id: true, name: true } } } },
          packages: { include: { package: { select: { id: true, name: true } } } },
        },
      });

      // TODO (Phase 2): generate invoice
      // TODO (Phase 2): update customer total visits
      // TODO (Phase 2): reserve booking slot
      // TODO (Phase 2): create appointment reminders
      // TODO (Phase 2): send SMS / WhatsApp / Email confirmation
      // TODO (Phase 2): loyalty points
      // TODO (Phase 2): membership usage
      // TODO (Phase 2): audit log
      // TODO (Phase 2): activity log

      return createdAppointment;
    });

    return created(appointment, "Appointment booked successfully");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2002":
          return err("Appointment number already exists, please retry", 409);
        case "P2003":
          return err(
            "Invalid branch, worker, service, add-on, or package reference",
            400
          );
      }
    }

    console.error("POST Customer Appointment Error:", error);
    return err("Internal server error", 500);
  }
}
