import { NextRequest } from "next/server";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Appointments
// ROUTE  : /api/v1/worker/appointments/[id]/complete
//
// METHOD
// POST - Complete service
//
// ACCESS
// WORKER
//
// Optional body: { serviceNotes?: string, services?: Array<{ serviceId:
// string, serviceNotes?: string, productsUsed?: Array<{ productId: string,
// quantity: number }> }> } — lets the worker log per-service notes/products
// consumed at completion time, matching the AppointmentService.serviceNotes
// / .productsUsed (Json) fields in your schema. Both are optional; omitting
// them just completes the appointment with no extra detail recorded.
// ============================================================================

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type ProductUsed = { productId: string; quantity: number };
type ServiceCompletionInput = {
  serviceId: string;
  serviceNotes?: string;
  productsUsed?: ProductUsed[];
};

function isValidProductsUsed(value: unknown): value is ProductUsed[] {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      item !== null &&
      typeof item === "object" &&
      isNonEmptyString((item as Record<string, unknown>).productId) &&
      typeof (item as Record<string, unknown>).quantity === "number" &&
      Number.isFinite((item as Record<string, unknown>).quantity as number) &&
      ((item as Record<string, unknown>).quantity as number) > 0
  );
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

    const appointment = await prisma.appointment.findFirst({
      where: { id, workerId: user.workerId },
      select: {
        id: true,
        status: true,
        startedAt: true,
        completedAt: true,
        services: { select: { id: true, serviceId: true } },
      },
    });

    if (!appointment) {
      return err("Appointment not found", 404);
    }

    if (appointment.completedAt || appointment.status === AppointmentStatus.COMPLETED) {
      return err("This appointment has already been completed", 409);
    }

    if (!appointment.startedAt) {
      return err("Appointment must be started before it can be completed", 400);
    }

    if (appointment.status === AppointmentStatus.CANCELLED || appointment.status === AppointmentStatus.NO_SHOW) {
      return err("This appointment cannot be completed", 400);
    }

    const body = await req.json().catch(() => ({}));
    const rawServices = (body as { services?: unknown }).services;

    const serviceCompletions: ServiceCompletionInput[] = [];

    if (rawServices !== undefined) {
      if (!Array.isArray(rawServices)) {
        return err("services must be an array");
      }

      for (const item of rawServices) {
        if (
          item === null ||
          typeof item !== "object" ||
          !isNonEmptyString((item as Record<string, unknown>).serviceId)
        ) {
          return err("Each service completion entry needs a valid serviceId");
        }

        const serviceNotes = (item as Record<string, unknown>).serviceNotes;
        if (serviceNotes !== undefined && typeof serviceNotes !== "string") {
          return err("serviceNotes must be a string");
        }

        const productsUsed = (item as Record<string, unknown>).productsUsed;
        if (!isValidProductsUsed(productsUsed)) {
          return err("productsUsed must be an array of { productId, quantity > 0 }");
        }

        serviceCompletions.push({
          serviceId: (item as Record<string, unknown>).serviceId as string,
          serviceNotes: serviceNotes as string | undefined,
          productsUsed: productsUsed as ProductUsed[] | undefined,
        });
      }

      // Every referenced serviceId must actually belong to this appointment.
      const validServiceIds = new Set(appointment.services.map((s) => s.serviceId));
      const invalid = serviceCompletions.find((s) => !validServiceIds.has(s.serviceId));
      if (invalid) {
        return err(`Service ${invalid.serviceId} is not part of this appointment`, 400);
      }
    }

    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const updatedAppointment = await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          status: AppointmentStatus.COMPLETED,
          completedAt: now,
        },
      });

      // Complete every service on the appointment. Services with matching
      // per-service completion details get those recorded; the rest are
      // just marked completed with no extra notes.
      for (const svc of appointment.services) {
        const match = serviceCompletions.find((c) => c.serviceId === svc.serviceId);
        await tx.appointmentService.update({
          where: { id: svc.id },
          data: {
            status: AppointmentStatus.COMPLETED,
            completedAt: now,
            ...(match?.serviceNotes !== undefined ? { serviceNotes: match.serviceNotes } : {}),
            ...(match?.productsUsed !== undefined ? { productsUsed: match.productsUsed } : {}),
          },
        });
      }

      // TODO (Phase 2): generate/finalize invoice
      // TODO (Phase 2): update customer totalVisits
      // TODO (Phase 2): request review (reviewRequested flag exists on Appointment)
      // TODO (Phase 2): loyalty points
      // TODO (Phase 2): notify customer
      // TODO (Phase 2): audit log

      return updatedAppointment;
    });

    return ok(updated, "Service completed successfully");
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return err("Appointment not found", 404);
    }

    console.error("POST Worker Complete Service Error:", error);
    return err("Internal server error", 500);
  }
}