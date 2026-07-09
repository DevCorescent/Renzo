import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

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
// BRANCH_ADMIN
// RECEPTIONIST
// ============================================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN",
    "RECEPTIONIST"
  );

  if (error) return error;

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

    if (!appointment) {
      return err("Appointment not found", 404);
    }

    // ------------------------------------------------------------------------
    // Check Worker
    // ------------------------------------------------------------------------

    const worker = await prisma.workerProfile.findUnique({
      where: {
        id: workerId.trim(),
      },
    });

    if (!worker) {
      return err("Worker not found", 404);
    }

    // ------------------------------------------------------------------------
    // Assign Worker
    // ------------------------------------------------------------------------

    const updatedAppointment =
      await prisma.appointment.update({
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
