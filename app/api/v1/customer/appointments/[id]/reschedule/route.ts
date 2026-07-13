import { NextRequest } from "next/server";
import { AppointmentStatus, Prisma, RescheduleStatus } from "@prisma/client";

import { created, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Customer Reschedule
// ROUTE  : /api/v1/customer/appointments/[id]/reschedule
//
// METHOD
// POST - Customer Reschedule Request
//
// ACCESS
// CUSTOMER
// ============================================================================

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const NON_RESCHEDULABLE_STATUSES: string[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// UTC-based "today at midnight" so this compares on the same clock as
// parsedDate below, regardless of the server process's local timezone.
function todayUtcMidnight(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;

  try {
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return err("Invalid request body");
    }

    const { newDate, newTime, reason } = body;

    // ------------------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------------------

    if (!isNonEmptyString(newDate)) {
      return err("New appointment date is required");
    }
    if (!DATE_RE.test(newDate.trim())) {
      return err("Invalid date format. Use YYYY-MM-DD");
    }

    if (!isNonEmptyString(newTime)) {
      return err("New appointment time is required");
    }
    if (!TIME_RE.test(newTime.trim())) {
      return err("Invalid time format. Use HH:mm");
    }

    if (!isNonEmptyString(reason)) {
      return err("Reason is required");
    }

    const parsedDate = new Date(`${newDate.trim()}T00:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      return err("Invalid appointment date");
    }

    if (parsedDate < todayUtcMidnight()) {
      return err("New appointment date cannot be in the past");
    }

    // ------------------------------------------------------------------------
    // Appointment Validation
    // ------------------------------------------------------------------------

    const appointment = await prisma.appointment.findFirst({
      where: { id, customerId: user.customerId },
      select: { id: true, status: true, appointmentDate: true, startTime: true },
    });

    if (!appointment) {
      return err("Appointment not found", 404);
    }

    if (NON_RESCHEDULABLE_STATUSES.includes(appointment.status)) {
      return err("This appointment cannot be rescheduled", 400);
    }

    // ------------------------------------------------------------------------
    // Create Reschedule Request
    //
    // The duplicate-pending-request check now runs INSIDE the transaction,
    // immediately before the create, to shrink the window in which two
    // concurrent submissions (e.g. a double-tapped submit button) could
    // both pass the check and both create a pending request. This narrows
    // the race but isn't fully atomic without a DB-level partial unique
    // index (e.g. on appointmentId where status = 'PENDING') — recommend
    // adding one at the schema level as the real fix; the P2002 handler
    // below is the backstop for when that constraint exists and fires.
    // ------------------------------------------------------------------------

    const rescheduleRequest = await prisma.$transaction(async (tx) => {
      const existingRequest = await tx.rescheduleRequest.findFirst({
        where: { appointmentId: appointment.id, status: RescheduleStatus.PENDING },
      });

      if (existingRequest) {
        throw new Error("DUPLICATE_PENDING_REQUEST");
      }

      const request = await tx.rescheduleRequest.create({
        data: {
          appointmentId: appointment.id,
          requestedBy: user.userId,
          requestedByType: "CUSTOMER",
          workerId: null,
          originalDate: appointment.appointmentDate,
          originalTime: appointment.startTime,
          newDate: parsedDate,
          newTime: newTime.trim(),
          reason: reason.trim(),
          status: RescheduleStatus.PENDING,
        },
        include: {
          appointment: {
            select: {
              id: true,
              appointmentNo: true,
              appointmentDate: true,
              startTime: true,
              status: true,
            },
          },
          worker: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      // TODO (Phase 2): validate slot availability
      // TODO (Phase 2): check branch reschedule policy
      // TODO (Phase 2): auto approve if branch setting allows
      // TODO (Phase 2): notify branch admin / receptionist
      // TODO (Phase 2): notify customer
      // TODO (Phase 2): audit log
      // TODO (Phase 2): activity log

      return request;
    });

    return created(rescheduleRequest, "Reschedule request submitted successfully");
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_PENDING_REQUEST") {
      return err("A reschedule request is already pending", 409);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2002":
          return err("A reschedule request is already pending", 409);
        case "P2003":
          return err("Invalid appointment reference", 400);
        case "P2025":
          return err("Appointment not found", 404);
      }
    }

    console.error("POST Customer Reschedule Error:", error);
    return err("Internal server error", 500);
  }
}
