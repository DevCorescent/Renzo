import { NextRequest } from "next/server";
import {
  Prisma,
  AppointmentStatus,
  PaymentStatus,
} from "@prisma/client";
import { err, paginated, created } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Appointments
// ROUTE  : /api/v1/admin/appointments
//
// METHODS
// GET  - List Appointments
// POST - Create Appointment
//
// ACCESS
// GET  : SUPER_ADMIN, OWNER, BRANCH_ADMIN
// POST : SUPER_ADMIN, OWNER, BRANCH_ADMIN
// ============================================================================

function optionalTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

function parseFiniteNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : NaN;
}

/* ============================================================================
   GET /api/v1/admin/appointments
============================================================================ */

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN"
  );

  if (error) return error;

  try {
    const url = new URL(req.url);

    const page = Math.max(
      Number(url.searchParams.get("page") ?? "1"),
      1
    );

    const limit = Math.min(
      Math.max(
        Number(url.searchParams.get("limit") ?? "10"),
        1
      ),
      100
    );

    const skip = (page - 1) * limit;

    const search = url.searchParams.get("search")?.trim();

    const status = url.searchParams.get("status");

    const paymentStatus =
      url.searchParams.get("paymentStatus");

    const branchId =
      url.searchParams.get("branchId");

    const workerId =
      url.searchParams.get("workerId");

    const appointmentDate =
      url.searchParams.get("appointmentDate");

    const where: Prisma.AppointmentWhereInput = {};

    // ------------------------------------------------------------------------
    // Search
    // ------------------------------------------------------------------------

    if (search) {
      where.OR = [
        {
          appointmentNo: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          customer: {
            firstName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
        {
          customer: {
            lastName: {
              contains: search,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    // ------------------------------------------------------------------------
    // Filters
    // ------------------------------------------------------------------------

    if (status) {
      where.status = status as AppointmentStatus;
    }

    if (paymentStatus) {
      where.paymentStatus =
        paymentStatus as PaymentStatus;
    }

    if (branchId) {
      where.branchId = branchId;
    }

    if (workerId) {
      where.workerId = workerId;
    }

    if (appointmentDate) {
      const date = new Date(appointmentDate);

      if (!Number.isNaN(date.getTime())) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);

        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        where.appointmentDate = {
          gte: start,
          lte: end,
        };
      }
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip,
        take: limit,

        orderBy: [
          {
            appointmentDate: "desc",
          },
          {
            startTime: "asc",
          },
        ],

        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },

          branch: {
            select: {
              id: true,
              name: true,
            },
          },

          worker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },

          services: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },

          packages: {
            include: {
              package: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },

          addOns: {
            include: {
              addOn: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },

          _count: {
            select: {
              services: true,
              packages: true,
              addOns: true,
            },
          },
        },
      }),

      prisma.appointment.count({
        where,
      }),
    ]);

    return paginated(
      appointments,
      total,
      page,
      limit,
      "Appointments fetched successfully"
    );
  } catch (error) {
    console.error(
      "GET Appointments Error:",
      error
    );

    return err(
      "Internal server error",
      500
    );
  }
}
/* ============================================================================
   POST /api/v1/admin/appointments
============================================================================ */

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN"
  );

  if (error) return error;

  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return err("Invalid request body");
    }

    const {
      customerId,
      branchId,
      workerId,
      appointmentDate,
      startTime,
      endTime,
      notes,
      internalNotes,
      chairCabinNo,
      source = "ONLINE",
    } = body;

    // ------------------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------------------

    if (!optionalTrimmedString(customerId)) {
      return err("Customer is required");
    }

    if (!optionalTrimmedString(branchId)) {
      return err("Branch is required");
    }

    if (!optionalTrimmedString(appointmentDate)) {
      return err("Appointment date is required");
    }

    if (!optionalTrimmedString(startTime)) {
      return err("Start time is required");
    }

    const parsedDate = new Date(appointmentDate);

    if (Number.isNaN(parsedDate.getTime())) {
      return err("Invalid appointment date");
    }

    // ------------------------------------------------------------------------
    // Check Customer
    // ------------------------------------------------------------------------

    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId,
      },
    });

    if (!customer) {
      return err("Customer not found", 404);
    }

    // ------------------------------------------------------------------------
    // Check Branch
    // ------------------------------------------------------------------------

    const branch = await prisma.branch.findUnique({
      where: {
        id: branchId,
      },
    });

    if (!branch) {
      return err("Branch not found", 404);
    }

    // ------------------------------------------------------------------------
    // Check Worker (Optional)
    // ------------------------------------------------------------------------

    if (workerId) {
      const worker = await prisma.workerProfile.findUnique({
        where: {
          id: workerId,
        },
      });

      if (!worker) {
        return err("Worker not found", 404);
      }
    }

    // ------------------------------------------------------------------------
    // Generate Appointment Number
    // ------------------------------------------------------------------------

    const appointmentNo = `APT-${Date.now()}`;

    // ------------------------------------------------------------------------
    // Create Appointment
    // ------------------------------------------------------------------------

    const appointment = await prisma.appointment.create({
      data: {
        appointmentNo,

        customerId,

        branchId,

        workerId: optionalTrimmedString(workerId) ?? null,

        appointmentDate: parsedDate,

        startTime: startTime.trim(),

        endTime:
          optionalTrimmedString(endTime) ??
          startTime.trim(),

        totalDuration: 0,

        status: AppointmentStatus.PENDING,

        paymentStatus: PaymentStatus.PENDING,

        source,

        subtotal: 0,

        taxAmount: 0,

        discountAmount: 0,

        totalAmount: 0,

        paidAmount: 0,

        notes:
          optionalTrimmedString(notes) ?? null,

        internalNotes:
          optionalTrimmedString(internalNotes) ??
          null,

        chairCabinNo:
          optionalTrimmedString(chairCabinNo) ??
          null,
      },

      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },

        branch: {
          select: {
            id: true,
            name: true,
          },
        },

        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
    });

    return created(
      appointment,
      "Appointment created successfully"
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2002":
          return err(
            "Appointment number already exists",
            409
          );

        case "P2003":
          return err(
            "Invalid customer, branch or worker",
            400
          );
      }
    }

    console.error(
      "POST Appointment Error:",
      error
    );

    return err(
      "Internal server error",
      500
    );
  }
}