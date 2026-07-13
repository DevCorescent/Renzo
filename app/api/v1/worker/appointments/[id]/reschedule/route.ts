import { NextRequest } from "next/server";
import { AppointmentStatus, Prisma, RescheduleStatus } from "@prisma/client";
import { created, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Appointments
// ROUTE  : /api/v1/worker/appointments/[id]/reschedule
//
// METHOD
// POST - Request reschedule
//
// ACCESS
// WORKER
//
// VERIFY: RescheduleRequest.workerId is set to the requesting worker's id
// here (they're rescheduling their own appointment). If that field is
// instead meant to represent "which worker the appointment should move
// TO" rather than "who requested it," this needs to be null here instead
// — the schema alone doesn't disambiguate; requestedBy already separately
// captures who made the request.
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

function todayUtcMidnight(): Date {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
}

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
    // Appointment Validation — scoped to this worker's own appointment
    // ------------------------------------------------------------------------

    const appointment = await prisma.appointment.findFirst({
      where: { id, workerId: user.workerId },
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
    // Duplicate-pending check runs inside the transaction to narrow the
    // race window (see the customer reschedule route for the full note on
    // why a DB-level partial unique index on [appointmentId] where
    // status = PENDING is the real fix — same caveat applies here).
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
          requestedByType: "WORKER",
          workerId: user.workerId,
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
          worker: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // TODO (Phase 2): validate slot availability
      // TODO (Phase 2): check branch reschedule policy
      // TODO (Phase 2): notify customer
      // TODO (Phase 2): notify branch admin / receptionist
      // TODO (Phase 2): audit log

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

    console.error("POST Worker Reschedule Error:", error);
    return err("Internal server error", 500);
  }
}