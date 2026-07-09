import { NextRequest } from "next/server";
import { AppointmentStatus, Prisma } from "@prisma/client";

import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Service Start
// ROUTE  : /api/v1/worker/appointments/[id]/start
//
// METHOD
// POST - Start Service
//
// ACCESS
// WORKER
// ============================================================================

const STARTABLE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const { id } = await params;

    if (!user.workerId) {
      return err("Your account is not linked to a worker profile", 403);
    }

    // ------------------------------------------------------------------------
    // Appointment Validation
    // ------------------------------------------------------------------------

    const appointment = await prisma.appointment.findFirst({
      where: {
        id,
        workerId: user.workerId,
      },
      select: {
        id: true,
        workerId: true,
        status: true,
        startedAt: true,
        completedAt: true,
      },
    });

    if (!appointment) {
      return err("Appointment not found", 404);
    }

    if (appointment.completedAt) {
      return err("Appointment has already been completed", 409);
    }

    if (appointment.startedAt) {
      return err("Appointment has already been started", 409);
    }

    if (!STARTABLE_STATUSES.includes(appointment.status)) {
      return err(
        `Appointment cannot be started from status ${appointment.status}`,
        400
      );
    }
        // ------------------------------------------------------------------------
    // Start Appointment
    // ------------------------------------------------------------------------

    const updatedAppointment = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Update Appointment
      const appointmentRecord = await tx.appointment.update({
        where: {
          id: appointment.id,
        },
        data: {
          status: AppointmentStatus.STARTED,
          startedAt: now,
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

              variant: {
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

          _count: {
            select: {
              services: true,
              addOns: true,
              packages: true,
            },
          },
        },
      });

      // ----------------------------------------------------------------------
      // Start all appointment services that are still pending
      // ----------------------------------------------------------------------

      await tx.appointmentService.updateMany({
        where: {
          appointmentId: appointment.id,
          startedAt: null,
        },
        data: {
          status: AppointmentStatus.STARTED,
          startedAt: now,
        },
      });

      // ----------------------------------------------------------------------
      // Phase 2
      // ----------------------------------------------------------------------

      // TODO: create activity log
      // TODO: create audit log
      // TODO: notify customer
      // TODO: notify reception
      // TODO: trigger inventory reservation
      // TODO: send push notification

      return appointmentRecord;
    });

    return ok(updatedAppointment, "Service started successfully");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2025":
          return err("Appointment not found", 404);

        case "P2003":
          return err("Invalid appointment reference", 400);
      }
    }

    console.error("POST Worker Start Appointment Error:", error);

    return err("Internal server error", 500);
  }
}