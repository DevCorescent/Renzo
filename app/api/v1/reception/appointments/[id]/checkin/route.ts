import { NextRequest } from "next/server";
import { AppointmentStatus, Prisma } from "@prisma/client";

import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Customer Cancel
// ROUTE  : /api/v1/customer/appointments/[id]/checkin
//
// METHOD
// POST - Cancel Appointment
//
// ACCESS
// CUSTOMER
// ============================================================================

// VERIFY: does AppointmentStatus include an "in progress" / "checked in"
// value? Appointment.checkedInAt / startedAt exist as separate timestamp
// fields, which strongly implies corresponding status values do too —
// please paste the actual `enum AppointmentStatus { ... }` to confirm and
// complete this list.
const NON_CANCELLABLE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function combinedDateTime(date: Date, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const combined = new Date(date);
  combined.setUTCHours(h, m, 0, 0);
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

    const appointmentStart = combinedDateTime(appointment.appointmentDate, appointment.startTime);
    if (appointmentStart < new Date()) {
      return err("This appointment has already passed and cannot be cancelled", 400);
    }

    // ------------------------------------------------------------------------
    // Cancel Appointment
    //
    // Two writes, one transaction: the Appointment row moves to CANCELLED
    // (status/cancelledAt/cancellationReason — all real fields on this
    // model), and a CancellationRecord is created to hold who cancelled it
    // and any refund/charge amounts. There's no `cancelledBy` field on
    // Appointment itself — that data belongs on CancellationRecord, which
    // is also where Phase 2's refund/charge calculation TODOs plug in.
    // ------------------------------------------------------------------------

    const result = await prisma.$transaction(async (tx) => {
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: AppointmentStatus.CANCELLED,
          cancellationReason: reason.trim(),
          cancelledAt: new Date(),
        },
        include: {
          branch: { select: { id: true, name: true } },
          worker: { select: { id: true, firstName: true, lastName: true } },
          services: { include: { service: { select: { id: true, name: true } } } },
          addOns: { include: { addOn: { select: { id: true, name: true } } } },
          packages: { include: { package: { select: { id: true, name: true } } } },
        },
      });

      const cancellationRecord = await tx.cancellationRecord.create({
        data: {
          appointmentId: appointment.id,
          cancelledBy: user.userId,
          cancelledByType: "CUSTOMER",
          reason: reason.trim(),
          // TODO (Phase 2): calculate actual refund/charge amounts based on
          // paymentStatus, totalAmount, and branch cancellation policy —
          // currently both stubbed at 0.
          refundAmount: 0,
          chargeAmount: 0,
        },
      });

      // TODO (Phase 2): process refund
      // TODO (Phase 2): restore slot availability
      // TODO (Phase 2): refund loyalty points / wallet
      // TODO (Phase 2): notify customer
      // TODO (Phase 2): notify branch / receptionist
      // TODO (Phase 2): send Email / SMS / WhatsApp
      // TODO (Phase 2): audit log
      // TODO (Phase 2): activity log

      return { ...updatedAppointment, cancellationRecord };
    });

    return ok(result, "Appointment cancelled successfully");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2025":
          return err("Appointment not found", 404);
        case "P2003":
          return err("Invalid appointment reference", 400);
        case "P2002":
          // appointmentId is @unique on CancellationRecord — this appointment
          // was already cancelled by a concurrent/duplicate request.
          return err("This appointment has already been cancelled", 409);
      }
    }

    console.error("POST Customer Cancel Appointment Error:", error);
    return err("Internal server error", 500);
  }
}