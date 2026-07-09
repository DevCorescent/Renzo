import { NextRequest } from "next/server";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Reception Assign Worker
// ROUTE  : /api/v1/reception/appointments/[id]/assign
//
// METHOD
// PATCH - Reassign worker for an appointment
//
// ACCESS
// RECEPTIONIST, BRANCH_ADMIN, SUPER_ADMIN, OWNER
// ============================================================================

// VERIFY: exact AppointmentStatus enum values. checkedInAt/startedAt/
// completedAt exist as separate timestamp fields on Appointment, implying
// corresponding status values (e.g. CHECKED_IN, IN_PROGRESS) likely exist.
// An appointment that's already underway or finished shouldn't have its
// worker silently swapped — extend this list once the enum is confirmed.
const NON_ASSIGNABLE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.CANCELLED,
  AppointmentStatus.NO_SHOW,
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export async function PATCH(
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

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return err("Invalid request body");
    }

    const { workerId } = body;

    if (!isNonEmptyString(workerId)) {
      return err("Worker is required");
    }

    // ------------------------------------------------------------------------
    // Branch scoping
    // ------------------------------------------------------------------------
    // Same fail-safe pattern as the reception appointments list route: a
    // receptionist/branch admin without a branch assignment must not fall
    // through to unrestricted access.

    let branchScope: string | undefined;
    if (user.userType === "RECEPTIONIST" || user.userType === "BRANCH_ADMIN") {
      if (!isNonEmptyString(user.branchId)) {
        return err("Your account is not assigned to a branch", 403);
      }
      branchScope = user.branchId;
    }

    // ------------------------------------------------------------------------
    // Appointment Validation
    // ------------------------------------------------------------------------

    const appointment = await prisma.appointment.findFirst({
      where: {
        id,
        ...(branchScope ? { branchId: branchScope } : {}),
      },
      select: {
        id: true,
        branchId: true,
        workerId: true,
        status: true,
        appointmentDate: true,
        startTime: true,
        endTime: true,
      },
    });

    if (!appointment) {
      return err("Appointment not found", 404);
    }

    if (NON_ASSIGNABLE_STATUSES.includes(appointment.status)) {
      return err("Worker cannot be changed for this appointment", 400);
    }

    // ------------------------------------------------------------------------
    // Worker Validation
    // ------------------------------------------------------------------------
    // VERIFY: WorkerProfile is assumed to have a `branchId` field, based on
    // the branch-scoped worker patterns used elsewhere in this codebase
    // (e.g. admin worker listing filterable by branch per TEAM.md). Confirm
    // the exact field name against the real WorkerProfile model.

    const worker = await prisma.workerProfile.findUnique({
      where: { id: workerId },
      select: { id: true, firstName: true, lastName: true, isActive: true, branchId: true },
    });

    if (!worker || !worker.isActive) {
      return err("Worker not found", 404);
    }

    if (worker.branchId !== appointment.branchId) {
      return err("Selected worker does not belong to this appointment's branch", 400);
    }

    if (appointment.workerId === worker.id) {
      return err("This worker is already assigned to the appointment", 409);
    }

    // TODO: validate the worker can perform the services already booked on
    // this appointment (mirrors the same deferred check in the customer
    // booking route — needs a WorkerService-style mapping to enforce).

    // ------------------------------------------------------------------------
    // Conflict Check
    // ------------------------------------------------------------------------
    // Prevent assigning a worker who is already booked elsewhere for an
    // overlapping time on the same date.

    const newStart = timeToMinutes(appointment.startTime);
    const newEnd = timeToMinutes(appointment.endTime);

    const conflicting = await prisma.appointment.findMany({
      where: {
        id: { not: appointment.id },
        workerId: worker.id,
        appointmentDate: appointment.appointmentDate,
        status: { notIn: NON_ASSIGNABLE_STATUSES },
      },
      select: { startTime: true, endTime: true },
    });

    const hasConflict = conflicting.some((c) =>
      rangesOverlap(newStart, newEnd, timeToMinutes(c.startTime), timeToMinutes(c.endTime))
    );

    if (hasConflict) {
      return err("Worker already has a conflicting appointment at this time", 409);
    }

    // ------------------------------------------------------------------------
    // Reassign Worker
    // ------------------------------------------------------------------------
    // Both the appointment-level worker and every service line item under
    // it are updated together, consistent with how a worker is assigned
    // uniformly across all services at booking time elsewhere in this
    // codebase. If per-service worker assignment is meant to diverge from
    // the appointment-level worker, this needs a different endpoint/shape.

    const updated = await prisma.$transaction(async (tx) => {
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointment.id },
        data: { workerId: worker.id },
        include: {
          branch: { select: { id: true, name: true } },
          worker: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      await tx.appointmentService.updateMany({
        where: { appointmentId: appointment.id },
        data: { workerId: worker.id },
      });

      return updatedAppointment;
    });

    return ok(updated, "Worker reassigned successfully");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2025":
          return err("Appointment not found", 404);
        case "P2003":
          return err("Invalid worker reference", 400);
      }
    }

    console.error("PATCH Reception Assign Worker Error:", error);
    return err("Internal server error", 500);
  }
}