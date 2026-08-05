import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope, denyIfWorkerOutOfScope } from "@/lib/branch-scope";
import prisma from "@/lib/db";
import { notifyWorkerAppointmentAssigned } from "@/lib/notifications";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Appointment Assign
// ROUTE  : /api/v1/admin/appointments/[id]/assign
//
// METHOD
// PATCH - Assign Worker to Appointment
//
// ACCESS
// SUPER_ADMIN
// OWNER
// BRANCH_ADMIN   (own branch only)
// RECEPTIONIST   (own branch only)
//
// BRANCH SCOPE
// BOTH sides are checked, because either one alone leaves a hole: an unchecked
// APPOINTMENT lets a desk staff another branch's booking, and an unchecked
// WORKER lets them roster somebody who does not work there — and notify that
// person about a shift at a salon they have never been to.
// ============================================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN",
    "RECEPTIONIST"
  );

  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const { id } = await params;

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return err("Invalid request body");
    }

    const { workerId } = body;

    // ------------------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------------------

    if (
      !workerId ||
      typeof workerId !== "string" ||
      !workerId.trim()
    ) {
      return err("Worker is required");
    }

    // ------------------------------------------------------------------------
    // Check Appointment
    // ------------------------------------------------------------------------

    const appointment = await prisma.appointment.findUnique({
      where: {
        id,
      },
    });

    // 404, not 403 — a 403 would confirm the id belongs to a real appointment.
    if (!appointment || (!scope.isGlobal && appointment.branchId !== scope.branchId)) {
      return err("Appointment not found", 404);
    }

    // ------------------------------------------------------------------------
    // Check Worker
    // ------------------------------------------------------------------------

    const worker = await prisma.workerProfile.findUnique({
      where: {
        id: workerId.trim(),
      },
      select: { id: true, userId: true },
    });

    if (!worker) {
      return err("Worker not found", 404);
    }

    // WorkerProfile has no branchId column, so membership is read from the
    // WorkerBranch join table. Also answers 404.
    const workerDenied = await denyIfWorkerOutOfScope(prisma, worker.id, scope);
    if (workerDenied) return workerDenied;

    // Only a real change should notify — re-assigning the same worker is a no-op alert.
    const workerChanged = appointment.workerId !== worker.id;

    // ------------------------------------------------------------------------
    // Assign Worker (+ notify the newly-assigned worker)
    //
    // Update and notify in ONE transaction, reusing the shared Notification
    // service, so the worker's assignment alert commits atomically with the write.
    // ------------------------------------------------------------------------

    const updatedAppointment = await prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: {
          id,
        },

        data: {
          workerId: worker.id,
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
              displayName: true,
            },
          },
        },
      });

      if (workerChanged && worker.userId) {
        await notifyWorkerAppointmentAssigned(tx, {
          id: updated.id,
          appointmentNo: updated.appointmentNo,
          appointmentDate: updated.appointmentDate,
          startTime: updated.startTime,
          workerUserId: worker.userId,
        });
      }

      return updated;
    });

    return ok(
      updatedAppointment,
      "Worker assigned successfully"
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case "P2025":
          return err("Appointment not found", 404);

        case "P2003":
          return err("Invalid worker", 400);
      }
    }

    console.error(
      "PATCH Appointment Assign Error:",
      error
    );

    return err(
      "Internal server error",
      500
    );
  }
}
