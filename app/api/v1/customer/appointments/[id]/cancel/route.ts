import { NextRequest } from "next/server";
import { AppointmentStatus, Prisma } from "@prisma/client";

import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Customer Cancel
// ROUTE  : /api/v1/customer/appointments/[id]/cancel
//
// METHOD
// POST - Cancel Appointment
//
// ACCESS
// CUSTOMER
// ============================================================================

// VERIFY: does AppointmentStatus include an "in progress" / "checked in"
// value (e.g. IN_PROGRESS, CHECKED_IN)? Your worker module has a
// POST /worker/appointments/[id]/start endpoint per TEAM.md, which implies
// such a status exists — if so, add it here so an appointment can't be
// cancelled while the worker is actively performing the service.
const NON_CANCELLABLE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// "HH:mm" — validated elsewhere on write, trusted as well-formed here.
function combinedDateTime(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const combined = new Date(date);
  combined.setHours(h, m, 0, 0);
  return combined;
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

    const { reason } = body;

    // ------------------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------------------

    if (!isNonEmptyString(reason)) {
      return err("Cancellation reason is required");
    }

    // ------------------------------------------------------------------------
    // Appointment Validation
    // ------------------------------------------------------------------------

    const appointment = await prisma.appointment.findFirst({
      where: { id, customerId: user.customerId },
      select: {
        id: true,
        appointmentNo: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        appointmentDate: true,
        startTime: true,
      },
    });

    if (!appointment) {
      return err("Appointment not found", 404);
    }

    if (NON_CANCELLABLE_STATUSES.includes(appointment.status)) {
      return err("This appointment cannot be cancelled", 400);
    }

    // Block cancelling something that has already happened, even if its
    // status was never manually advanced to COMPLETED/NO_SHOW.
    const appointmentStart = combinedDateTime(appointment.appointmentDate, appointment.startTime);
    if (appointmentStart < new Date()) {
      return err("This appointment has already passed and cannot be cancelled", 400);
    }

    // ------------------------------------------------------------------------
    // Cancel Appointment
    // ------------------------------------------------------------------------

    const cancelledAppointment = await prisma.$transaction(async (tx) => {
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancellationReason: reason.trim(),
          cancelledAt: new Date(),
          cancelledBy: user.userId,
        },
        include: {
          branch: { select: { id: true, name: true } },
          worker: { select: { id: true, firstName: true, lastName: true } },
          services: { include: { service: { select: { id: true, name: true } } } },
          addOns: { include: { addOn: { select: { id: true, name: true } } } },
          packages: { include: { package: { select: { id: true, name: true } } } },
        },
      });

      // TODO (Phase 2): calculate cancellation charges
      // TODO (Phase 2): process refund
      // TODO (Phase 2): restore slot availability
      // TODO (Phase 2): refund loyalty points / wallet
      // TODO (Phase 2): notify customer
      // TODO (Phase 2): notify branch / receptionist
      // TODO (Phase 2): send Email / SMS / WhatsApp
      // TODO (Phase 2): audit log
      // TODO (Phase 2): activity log

      return updatedAppointment;
    });

    return ok(cancelledAppointment, "Appointment cancelled successfully");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2025":
          return err("Appointment not found", 404);
        case "P2003":
          return err("Invalid appointment reference", 400);
      }
    }

    console.error("POST Customer Cancel Appointment Error:", error);
    return err("Internal server error", 500);
  }
}