import { NextRequest } from "next/server";
import { err, ok } from "@/lib/response";
import prisma from "@/lib/db";
import {
  DATE_RE,
  eligibleWorkerIds,
  getWorkerSlots,
  parseRequestedServiceIds,
} from "@/lib/slots";
import { salonNow } from "@/lib/branch-hours";

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
    // A booking is ONE appointment covering every selected service, so slot
    // width must be the summed duration. Accepting only `serviceId` meant a
    // two-service booking was checked against the first service's length and
    // could be offered a slot too short to actually hold it.
    const serviceIds = parseRequestedServiceIds(url);
    const workerId = url.searchParams.get("workerId")?.trim();
    const date = url.searchParams.get("date")?.trim();

    // ------------------------------------------------------------------------
    // Validation
    // ------------------------------------------------------------------------

    if (!branchId) return err("Branch ID is required");
    if (serviceIds.length === 0) return err("Service ID is required");
    if (!date) return err("Date is required");

    if (!DATE_RE.test(date)) {
      return err("Invalid date format. Use YYYY-MM-DD");
    }

    const appointmentDate = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(appointmentDate.getTime())) {
      return err("Invalid date format. Use YYYY-MM-DD");
    }

    // Salon-local today, not UTC today: before 05:30 IST the UTC date is still
    // yesterday, which let a genuinely past date through this guard.
    if (date < salonNow().dateKey) {
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

    const serviceRows = await prisma.service.findMany({
      where: { id: { in: serviceIds }, isActive: true },
      select: { id: true, name: true, duration: true },
    });
    if (serviceRows.length !== serviceIds.length) {
      return err("Service not found", 404);
    }

    const totalDuration = serviceRows.reduce((sum, s) => sum + s.duration, 0);
    // Shape kept for existing callers that read `data.service`.
    const service =
      serviceRows.length === 1
        ? { ...serviceRows[0], isActive: true }
        : {
            id: serviceRows.map((s) => s.id).join(","),
            name: serviceRows.map((s) => s.name).join(" + "),
            duration: totalDuration,
            isActive: true,
          };

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

      const eligible = await eligibleWorkerIds({ branchId, serviceIds });
      if (!eligible.includes(worker.id)) {
        return err(
          serviceIds.length === 1
            ? "This stylist does not offer the selected service at this branch"
            : "This stylist does not offer all of the selected services at this branch",
          422,
        );
      }
    }

    // ------------------------------------------------------------------------
    // Candidate workers
    // ------------------------------------------------------------------------

    const candidateIds = worker
      ? [worker.id]
      : await eligibleWorkerIds({ branchId, serviceIds });

    if (candidateIds.length === 0) {
      return ok(
        { branch, service, worker, date, slots: [], slotGrid: [] },
        serviceIds.length === 1
          ? "No stylists at this branch offer this service"
          : "No stylist at this branch offers all of the selected services"
      );
    }

    const { closed, byWorker, gridByWorker } = await getWorkerSlots({
      branchId,
      date,
      durationMinutes: totalDuration,
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

    // An empty grid here means the branch is open but nobody can work it —
    // on leave, off-roster, or the window is too short for the total duration.
    // Say so, rather than letting the UI guess.
    if (slotGrid.length === 0) {
      return ok(
        { branch, service, worker, date, slots, slotGrid },
        worker
          ? "This stylist isn't working on the selected date"
          : "No stylist is working on the selected date"
      );
    }

    return ok(
      { branch, service, worker, date, slots, slotGrid },
      "Available slots fetched successfully"
    );
  } catch (error) {
    console.error("GET Public Slots Error:", error);
    return err("Internal server error", 500);
  }
}
