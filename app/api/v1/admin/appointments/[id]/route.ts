import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import {
  addMinutesToTime,
  durationMinutesBetween,
  findAppointmentConflict,
} from "@/lib/appointment-conflict";
import { DATE_RE } from "@/lib/slots";
import { sendMail } from "@/lib/mailer";
import { appointmentRescheduleEmail } from "@/lib/email-templates";
import { revalidatePath } from "next/cache";
import { notify } from "@/lib/notifications";

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

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const EDITABLE_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "RESCHEDULED",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth(
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

    if (
      user.userType === "BRANCH_ADMIN" &&
      user.branchId &&
      existingAppointment.branchId !== user.branchId
    ) {
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
    // Validate Appointment Date / Time
    // ------------------------------------------------------------------------

    let parsedAppointmentDate:
      | Date
      | undefined;

    if (appointmentDate !== undefined) {
      const raw =
        typeof appointmentDate === "string"
          ? appointmentDate.trim()
          : "";
      if (DATE_RE.test(raw)) {
        parsedAppointmentDate = new Date(
          `${raw}T00:00:00.000Z`
        );
      } else {
        parsedAppointmentDate = new Date(
          appointmentDate
        );
      }

      if (
        Number.isNaN(
          parsedAppointmentDate.getTime()
        )
      ) {
        return err("Invalid appointment date");
      }
    }

    const nextStart =
      optionalTrimmedString(startTime) ??
      existingAppointment.startTime;
    let nextEnd =
      optionalTrimmedString(endTime) ??
      existingAppointment.endTime;

    if (startTime !== undefined && !TIME_RE.test(nextStart)) {
      return err("Invalid start time. Use HH:mm");
    }
    if (endTime !== undefined && !TIME_RE.test(nextEnd)) {
      return err("Invalid end time. Use HH:mm");
    }

    // If only start moved, keep the same duration.
    if (
      startTime !== undefined &&
      endTime === undefined
    ) {
      const duration = durationMinutesBetween(
        existingAppointment.startTime,
        existingAppointment.endTime
      );
      nextEnd = addMinutesToTime(
        nextStart,
        duration || 30
      );
    }

    const scheduleChanging =
      appointmentDate !== undefined ||
      startTime !== undefined ||
      endTime !== undefined ||
      workerId !== undefined;

    if (
      scheduleChanging &&
      !EDITABLE_STATUSES.has(existingAppointment.status)
    ) {
      return err(
        "This appointment can no longer be rescheduled",
        400
      );
    }

    if (scheduleChanging) {
      const nextWorkerId =
        workerId === undefined
          ? existingAppointment.workerId
          : optionalTrimmedString(workerId) ?? null;
      const nextDate =
        parsedAppointmentDate ??
        existingAppointment.appointmentDate;

      const conflict = await findAppointmentConflict({
        workerId: nextWorkerId,
        appointmentDate: nextDate,
        startTime: nextStart,
        endTime: nextEnd,
        excludeAppointmentId: id,
      });
      if (conflict) return err(conflict, 409);
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
              startTime === undefined
                ? undefined
                : nextStart,

            endTime:
              startTime !== undefined ||
              endTime !== undefined
                ? nextEnd
                : undefined,

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
                userId: true,
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

            services: true,
            packages: true,
            addOns: true,
          },
        });

      // Non-blocking reschedule notifications when date or time changed.
      const dateTimeChanged =
        appointmentDate !== undefined ||
        startTime !== undefined ||
        endTime !== undefined;
      if (dateTimeChanged) {
        const customerName = `${appointment.customer?.firstName ?? ""} ${appointment.customer?.lastName ?? ""}`.trim();
        const formattedDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(appointment.appointmentDate);

        // Email notification
        if (appointment.customer?.email) {
          const { subject, html, text } = appointmentRescheduleEmail({
            name: customerName,
            appointmentNo: appointment.appointmentNo,
            date: formattedDate,
            time: appointment.startTime,
            branch: appointment.branch?.name ?? "",
          });
          sendMail({ to: appointment.customer.email, subject, html, text });
        }

        // In-app notification
        if (appointment.customer?.userId) {
          notify(appointment.customer.userId, {
            type: "INFO",
            title: "Appointment Rescheduled",
            message: `Your appointment #${appointment.appointmentNo} has been moved to ${formattedDate} at ${appointment.startTime}`,
            href: `/customer/bookings/${id}`,
            refType: "APPOINTMENT",
            refId: id,
          }).catch(() => {});
        }
      }

      // Invalidate cached pages so all roles see the updated schedule.
      revalidatePath("/customer/bookings", "layout");
      revalidatePath("/branch-admin/appointments", "layout");
      revalidatePath(`/customer/bookings/${id}`);

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
