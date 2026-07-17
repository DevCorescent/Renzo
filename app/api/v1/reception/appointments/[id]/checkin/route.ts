import { NextRequest } from "next/server";
import { AppointmentStatus, Prisma } from "@prisma/client";

import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Reception Check-in
// ROUTE  : /api/v1/reception/appointments/[id]/checkin
//
// METHOD
// POST - Check in an appointment
//
// ACCESS
// RECEPTIONIST, BRANCH_ADMIN, SUPER_ADMIN, OWNER
// ============================================================================

const CHECKINABLE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.RESCHEDULED,
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth(
    req,
    "RECEPTIONIST",
    "BRANCH_ADMIN",
    "SUPER_ADMIN",
    "OWNER"
  );
  if (error) return error;

  try {
    const { id } = await params;

    let branchScope: string | undefined;
    if (user.userType === "RECEPTIONIST" || user.userType === "BRANCH_ADMIN") {
      if (!isNonEmptyString(user.branchId)) {
        return err("Your account is not assigned to a branch", 403);
      }
      branchScope = user.branchId;
    }

    const appointment = await prisma.appointment.findFirst({
      where: {
        id,
        ...(branchScope ? { branchId: branchScope } : {}),
      },
      select: {
        id: true,
        status: true,
        checkedInAt: true,
      },
    });

    if (!appointment) {
      return err("Appointment not found", 404);
    }

    if (appointment.status === AppointmentStatus.CHECKED_IN || appointment.checkedInAt) {
      return err("Appointment is already checked in", 409);
    }

    if (!CHECKINABLE_STATUSES.includes(appointment.status)) {
      return err(
        `Appointment cannot be checked in from status ${appointment.status}`,
        400
      );
    }

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: AppointmentStatus.CHECKED_IN,
        checkedInAt: new Date(),
      },
      include: {
        branch: { select: { id: true, name: true } },
        customer: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        worker: { select: { id: true, firstName: true, lastName: true } },
        services: {
          include: { service: { select: { id: true, name: true } } },
        },
      },
    });

    return ok(updated, "Appointment checked in successfully");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2025":
          return err("Appointment not found", 404);
      }
    }

    console.error("POST Reception Check-in Error:", error);
    return err("Internal server error", 500);
  }
}
