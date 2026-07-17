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
        { branch, service, worker, date, slots: [], slotGrid: [] },
        "No workers available for this service"
      );
    }

    const { closed, byWorker, gridByWorker } = await getWorkerSlots({
      branchId,
      date,
      durationMinutes: service.duration,
      workerIds: candidateIds,
    });

    if (closed) {
      return ok(
        { branch, service, worker, date, slots: [], slotGrid: [] },
        "Branch is closed on the selected date"
      );
    }

    // Union of free times (back-compat) + status grid across candidates.
    // A time is AVAILABLE if any eligible stylist is free; BOOKED if every
    // eligible stylist is busy; PAST if the slot has already passed.
    const union = new Set<string>();
    for (const id of candidateIds) {
      for (const slot of byWorker.get(id) ?? []) union.add(slot);
    }
    const slots = Array.from(union).sort();

    const statusRank = { PAST: 0, BOOKED: 1, AVAILABLE: 2 } as const;
    const merged = new Map<string, "AVAILABLE" | "BOOKED" | "PAST">();
    for (const id of candidateIds) {
      for (const entry of gridByWorker.get(id) ?? []) {
        const prev = merged.get(entry.time);
        if (!prev || statusRank[entry.status] > statusRank[prev]) {
          merged.set(entry.time, entry.status);
        }
      }
    }
    // When multiple workers: a slot stays BOOKED only if NO worker is AVAILABLE.
    if (!worker && candidateIds.length > 1) {
      for (const [time, status] of merged) {
        if (status === "AVAILABLE") continue;
        const anyoneFree = candidateIds.some((id) =>
          (byWorker.get(id) ?? []).includes(time)
        );
        if (anyoneFree) merged.set(time, "AVAILABLE");
      }
    }

    const slotGrid = Array.from(merged.entries())
      .map(([time, status]) => ({ time, status }))
      .sort((a, b) => a.time.localeCompare(b.time));

    return ok(
      { branch, service, worker, date, slots, slotGrid },
      "Available slots fetched successfully"
    );
  } catch (error) {
    console.error("GET Public Slots Error:", error);
    return err("Internal server error", 500);
  }
}
