import { NextRequest } from "next/server";
import { err, ok } from "@/lib/response";
import prisma from "@/lib/db";
import { DATE_RE, eligibleWorkerIds, getWorkerSlots } from "@/lib/slots";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Slot Availability
// ROUTE  : /api/v1/public/slots
//
// METHOD
// GET - Available Slots  (?branchId= &serviceId= &date= [&workerId=])
//
// ACCESS
// Public (No Authentication)
//
// Slot maths lives in lib/slots.ts and is shared with the worker picker, so
// the availability shown on a stylist's card is the same availability that
// gets booked here.
//
// With `workerId`  → only that stylist's free slots (their schedule alone).
// Without          → slots where ANY eligible stylist at the branch is free.
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const branchId = url.searchParams.get("branchId")?.trim();
    const serviceId = url.searchParams.get("serviceId")?.trim();
    const workerId = url.searchParams.get("workerId")?.trim();
    const date = url.searchParams.get("date")?.trim();

    // ------------------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------------------

    if (!branchId) return err("Branch ID is required");
    if (!serviceId) return err("Service ID is required");
    if (!date) return err("Date is required");

    if (!DATE_RE.test(date)) {
      return err("Invalid date format. Use YYYY-MM-DD");
    }

    const appointmentDate = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(appointmentDate.getTime())) {
      return err("Invalid date format. Use YYYY-MM-DD");
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (date < todayStr) {
      return err("Cannot fetch slots for a past date");
    }

    // ------------------------------------------------------------------------
    // Branch / Service
    // ------------------------------------------------------------------------

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true, isActive: true },
    });
    if (!branch || !branch.isActive) return err("Branch not found", 404);

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, name: true, duration: true, isActive: true },
    });
    if (!service || !service.isActive) return err("Service not found", 404);

    // ------------------------------------------------------------------------
    // Worker (optional). A named worker must be able to perform this service
    // at this branch — otherwise we'd hand out slots that POST /appointments
    // would refuse to book.
    // ------------------------------------------------------------------------

    let worker: {
      id: string;
      firstName: string;
      lastName: string;
      isActive: boolean;
    } | null = null;

    if (workerId) {
      worker = await prisma.workerProfile.findUnique({
        where: { id: workerId },
        select: { id: true, firstName: true, lastName: true, isActive: true },
      });
      if (!worker || !worker.isActive) return err("Worker not found", 404);

      const eligible = await eligibleWorkerIds({ branchId, serviceId });
      if (!eligible.includes(worker.id)) {
        return err("This stylist does not offer the selected service at this branch", 422);
      }
    }

    // ------------------------------------------------------------------------
    // Candidate workers
    // ------------------------------------------------------------------------

    const candidateIds = worker
      ? [worker.id]
      : await eligibleWorkerIds({ branchId, serviceId });

    if (candidateIds.length === 0) {
      return ok(
        { branch, service, worker, date, slots: [] },
        "No workers available for this service"
      );
    }

    const { closed, byWorker } = await getWorkerSlots({
      branchId,
      date,
      durationMinutes: service.duration,
      workerIds: candidateIds,
    });

    if (closed) {
      return ok(
        { branch, service, worker, date, slots: [] },
        "Branch is closed on the selected date"
      );
    }

    // Union across candidates: a slot is offered if at least one eligible
    // stylist is free for it. With a named worker there is only one candidate,
    // so this collapses to exactly that stylist's schedule.
    const union = new Set<string>();
    for (const id of candidateIds) {
      for (const slot of byWorker.get(id) ?? []) union.add(slot);
    }
    const slots = Array.from(union).sort();

    return ok({ branch, service, worker, date, slots }, "Available slots fetched successfully");
  } catch (error) {
    console.error("GET Public Slots Error:", error);
    return err("Internal server error", 500);
  }
}
