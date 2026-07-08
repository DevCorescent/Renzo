import { NextRequest } from "next/server";
import {
  Prisma,
  AppointmentStatus,
} from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Appointment Status
// ROUTE  : /api/v1/admin/appointments/[id]/status
//
// METHOD
// PATCH - Update Appointment Status
//
// ACCESS
// SUPER_ADMIN
// OWNER
// BRANCH_ADMIN
// RECEPTIONIST
// ============================================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN",
    "RECEPTIONIST"
  );

  if (error) return error;

  try {
    const { id } = await params;

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return err("Invalid request body");
    }

    const { status } = body;

    // ------------------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------------------

    if (!status) {
      return err("Appointment status is required");
    }

    if (
      !Object.values(AppointmentStatus).includes(
        status as AppointmentStatus
      )
    ) {
      return err("Invalid appointment status");
    }

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
    // Timestamp Handling
    // ------------------------------------------------------------------------

    const now = new Date();

    const updateData: Prisma.AppointmentUpdateInput = {
      status: status as AppointmentStatus,
    };

    switch (status as AppointmentStatus) {
      case AppointmentStatus.CHECKED_IN:
        updateData.checkedInAt = now;
        break;

      case AppointmentStatus.STARTED:
        updateData.startedAt = now;
        break;

      case AppointmentStatus.COMPLETED:
        updateData.completedAt = now;
        break;

      case AppointmentStatus.CANCELLED:
        updateData.cancelledAt = now;
        break;
    }

    // ------------------------------------------------------------------------
    // Update Appointment
    // ------------------------------------------------------------------------

    const appointment =
      await prisma.appointment.update({
        where: {
          id,
        },

        data: updateData,

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

    return ok(
      appointment,
      "Appointment status updated successfully"
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError
    ) {
      switch (error.code) {
        case "P2025":
          return err("Appointment not found", 404);
      }
    }

    console.error(
      "PATCH Appointment Status Error:",
      error
    );

    return err(
      "Internal server error",
      500
    );
  }
}