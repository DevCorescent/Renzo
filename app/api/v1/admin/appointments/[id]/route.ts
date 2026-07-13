import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Appointments
// ROUTE  : /api/v1/admin/appointments/[id]
//
// METHODS
// GET   - Get Appointment
// PATCH - Update Appointment
//
// ACCESS
// GET   : SUPER_ADMIN, OWNER, BRANCH_ADMIN
// PATCH : SUPER_ADMIN, OWNER, BRANCH_ADMIN
// ============================================================================

function optionalTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

/* ============================================================================
   GET /api/v1/admin/appointments/[id]
============================================================================ */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN"
  );

  if (error) return error;

  try {
    const { id } = await params;

    const appointment = await prisma.appointment.findUnique({
      where: {
        id,
      },

      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
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
    });

    if (!appointment) {
      return err("Appointment not found", 404);
    }

    return ok(
      appointment,
      "Appointment fetched successfully"
    );
  } catch (error) {
    console.error(
      "GET Appointment Error:",
      error
    );

    return err(
      "Internal server error",
      500
    );
  }
}
/* ============================================================================
   PATCH /api/v1/admin/appointments/[id]
============================================================================ */

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN"
  );

  if (error) return error;

  try {
    const { id } = await params;

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return err("Invalid request body");
    }

    const {
      appointmentDate,
      startTime,
      endTime,
      workerId,
      notes,
      internalNotes,
      chairCabinNo,
    } = body;

    // ------------------------------------------------------------------------
    // Check Appointment
    // ------------------------------------------------------------------------

    const existingAppointment =
      await prisma.appointment.findUnique({
        where: {
          id,
        },
      });

    if (!existingAppointment) {
      return err("Appointment not found", 404);
    }

    // ------------------------------------------------------------------------
    // Validate Worker
    // ------------------------------------------------------------------------

    if (workerId) {
      const worker =
        await prisma.workerProfile.findUnique({
          where: {
            id: workerId,
          },
        });

      if (!worker) {
        return err("Worker not found", 404);
      }
    }

    // ------------------------------------------------------------------------
    // Validate Appointment Date
    // ------------------------------------------------------------------------

    let parsedAppointmentDate:
      | Date
      | undefined;

    if (appointmentDate !== undefined) {
      parsedAppointmentDate = new Date(
        appointmentDate
      );

      if (
        Number.isNaN(
          parsedAppointmentDate.getTime()
        )
      ) {
        return err("Invalid appointment date");
      }
    }

    // ------------------------------------------------------------------------
    // Update Appointment
    // ------------------------------------------------------------------------

    try {
      const appointment =
        await prisma.appointment.update({
          where: {
            id,
          },

          data: {
            appointmentDate:
              parsedAppointmentDate,

            startTime:
              optionalTrimmedString(startTime),

            endTime:
              optionalTrimmedString(endTime),

            workerId:
              workerId === undefined
                ? undefined
                : optionalTrimmedString(workerId) ??
                  null,

            notes:
              notes === undefined
                ? undefined
                : optionalTrimmedString(notes) ??
                  null,

            internalNotes:
              internalNotes === undefined
                ? undefined
                : optionalTrimmedString(
                    internalNotes
                  ) ?? null,

            chairCabinNo:
              chairCabinNo === undefined
                ? undefined
                : optionalTrimmedString(
                    chairCabinNo
                  ) ?? null,
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

            services: true,
            packages: true,
            addOns: true,
          },
        });

      return ok(
        appointment,
        "Appointment updated successfully"
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        switch (error.code) {
          case "P2025":
            return err("Appointment not found", 404);

          case "P2003":
            return err(
              "Invalid customer, branch or worker reference",
              400
            );
        }
      }

      console.error(
        "PATCH Appointment Error:",
        error
      );

      return err(
        "Internal server error",
        500
      );
    }
  } catch (error) {
    console.error(
      "PATCH Appointment Error:",
      error
    );

    return err(
      "Internal server error",
      500
    );
  }
}
