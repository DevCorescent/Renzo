import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Appointments
// ROUTE  : /api/v1/worker/appointments/[id]
//
// METHOD
// GET - Single appointment detail (own only)
//
// ACCESS
// WORKER
// ============================================================================

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