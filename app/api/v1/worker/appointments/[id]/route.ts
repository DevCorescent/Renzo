import { NextRequest } from "next/server";
import { AppointmentStatus, Prisma } from "@prisma/client";
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

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Appointments
// ROUTE  : /api/v1/worker/appointments/[id]
//
// METHODS
// GET   - Single appointment detail (own only)
// PATCH - Directly update date/time on own appointment
//
// ACCESS
// WORKER
// ============================================================================

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const EDITABLE_STATUSES = new Set<string>([
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.RESCHEDULED,
]);

export async function GET(
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

    // id + workerId together: prevents one worker from viewing another
    // worker's appointment by guessing an ID.
    const appointment = await prisma.appointment.findFirst({
      where: { id, workerId: user.workerId },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        branch: { select: { id: true, name: true, address: true, phone: true } },
        services: {
          include: {
            service: { select: { id: true, name: true, image: true, duration: true } },
            variant: { select: { id: true, name: true, duration: true } },
          },
        },
        addOns: { include: { addOn: { select: { id: true, name: true } } } },
        packages: { include: { package: { select: { id: true, name: true } } } },
        _count: { select: { services: true, addOns: true, packages: true } },
      },
    });

    if (!appointment) {
      return err("Appointment not found", 404);
    }

    return ok(appointment, "Appointment fetched successfully");
  } catch (error) {
    console.error("GET Worker Appointment Detail Error:", error);
    return err("Internal server error", 500);
  }
}

export async function PATCH(
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return err("Invalid request body");
    }

    const { appointmentDate, startTime, endTime } = body as {
      appointmentDate?: unknown;
      startTime?: unknown;
      endTime?: unknown;
    };

    if (
      appointmentDate === undefined &&
      startTime === undefined &&
      endTime === undefined
    ) {
      return err("Provide appointmentDate and/or startTime to update");
    }

    const existing = await prisma.appointment.findFirst({
      where: { id, workerId: user.workerId },
    });

    if (!existing) {
      return err("Appointment not found", 404);
    }

    if (!EDITABLE_STATUSES.has(existing.status)) {
      return err("This appointment can no longer be rescheduled", 400);
    }

    let parsedDate: Date | undefined;
    if (appointmentDate !== undefined) {
      const raw =
        typeof appointmentDate === "string" ? appointmentDate.trim() : "";
      if (!DATE_RE.test(raw)) {
        return err("Invalid date format. Use YYYY-MM-DD");
      }
      parsedDate = new Date(`${raw}T00:00:00.000Z`);
      if (Number.isNaN(parsedDate.getTime())) {
        return err("Invalid appointment date");
      }
    }

    const nextStart =
      typeof startTime === "string" && startTime.trim()
        ? startTime.trim()
        : existing.startTime;
    let nextEnd =
      typeof endTime === "string" && endTime.trim()
        ? endTime.trim()
        : existing.endTime;

    if (startTime !== undefined && !TIME_RE.test(nextStart)) {
      return err("Invalid start time. Use HH:mm");
    }
    if (endTime !== undefined && !TIME_RE.test(nextEnd)) {
      return err("Invalid end time. Use HH:mm");
    }

    if (startTime !== undefined && endTime === undefined) {
      const duration = durationMinutesBetween(
        existing.startTime,
        existing.endTime
      );
      nextEnd = addMinutesToTime(nextStart, duration || 30);
    }

    const nextDate = parsedDate ?? existing.appointmentDate;
    const conflict = await findAppointmentConflict({
      workerId: user.workerId,
      appointmentDate: nextDate,
      startTime: nextStart,
      endTime: nextEnd,
      excludeAppointmentId: id,
    });
    if (conflict) return err(conflict, 409);

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        appointmentDate: parsedDate,
        startTime: nextStart,
        endTime: nextEnd,
        status:
          existing.status === AppointmentStatus.PENDING
            ? AppointmentStatus.CONFIRMED
            : existing.status,
      },
      include: {
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true },
        },
        branch: { select: { id: true, name: true } },
      },
    });

    // Non-blocking reschedule notification to customer.
    if (appointment.customer?.email) {
      const { subject, html, text } = appointmentRescheduleEmail({
        name: `${appointment.customer.firstName} ${appointment.customer.lastName ?? ""}`.trim(),
        appointmentNo: appointment.appointmentNo,
        date: new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(appointment.appointmentDate),
        time: appointment.startTime,
        branch: appointment.branch?.name ?? "",
      });
      sendMail({ to: appointment.customer.email, subject, html, text });
    }

    // Invalidate cached appointment pages so all roles see the updated schedule.
    revalidatePath("/customer/bookings", "layout");
    revalidatePath("/branch-admin/appointments", "layout");
    revalidatePath(`/customer/bookings/${id}`);

    return ok(appointment, "Appointment updated successfully");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") return err("Appointment not found", 404);
    }
    console.error("PATCH Worker Appointment Error:", error);
    return err("Internal server error", 500);
  }
}