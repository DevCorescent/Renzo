import { NextRequest } from "next/server";
import { err, ok } from "@/lib/response";
import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Slot Availability
// ROUTE  : /api/v1/public/slots
//
// METHOD
// GET - Available Slots
//
// ACCESS
// Public (No Authentication)
//
// ASSUMPTIONS — VERIFY AGAINST YOUR ACTUAL prisma/schema.prisma:
// - prisma.branchTiming:      { branchId, dayOfWeek (0=Sun..6=Sat), openTime
//                               ("HH:mm"), closeTime ("HH:mm"), isClosed }
// - prisma.branchHoliday:     { branchId, date (DateTime) }
// - prisma.workerAvailability:{ workerId, date (DateTime), startTime, endTime }
//   (represents a BLOCKED window, not an available one — adjust the
//   overlap logic below if your schema means the opposite)
// - prisma.workerService:     { workerId, serviceId }  (join table used to
//   find which workers can perform the requested service, when no specific
//   workerId is given)
// - prisma.appointment:       { workerId, branchId, appointmentDate,
//                               startTime, endTime, status }
//   Non-blocking statuses (excluded from conflict checks): CANCELLED, NO_SHOW
// ============================================================================

const SLOT_INTERVAL_MINUTES = 30;
const NON_BLOCKING_STATUSES = ["CANCELLED", "NO_SHOW"] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

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

    // Construct as UTC midnight explicitly rather than relying on the
    // Date constructor's ambiguous string parsing.
    const appointmentDate = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(appointmentDate.getTime())) {
      return err("Invalid date format. Use YYYY-MM-DD");
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (date < todayStr) {
      return err("Cannot fetch slots for a past date");
    }

    // ------------------------------------------------------------------------
    // Branch
    // ------------------------------------------------------------------------

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, name: true, isActive: true },
    });

    if (!branch || !branch.isActive) {
      return err("Branch not found", 404);
    }

    // ------------------------------------------------------------------------
    // Service
    // ------------------------------------------------------------------------

    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, name: true, duration: true, isActive: true },
    });

    if (!service || !service.isActive) {
      return err("Service not found", 404);
    }

    // ------------------------------------------------------------------------
    // Worker (Optional)
    // ------------------------------------------------------------------------

    let worker: { id: string; firstName: string; lastName: string; isActive: boolean } | null = null;

    if (workerId) {
      worker = await prisma.workerProfile.findUnique({
        where: { id: workerId },
        select: { id: true, firstName: true, lastName: true, isActive: true },
      });

      if (!worker || !worker.isActive) {
        return err("Worker not found", 404);
      }
    }

    // ------------------------------------------------------------------------
    // Holiday check
    // ------------------------------------------------------------------------

    const holiday = await prisma.branchHoliday.findFirst({
      where: { branchId, date: appointmentDate },
    });

    if (holiday) {
      return ok(
        { branch, service, worker, date, slots: [] },
        "Branch is closed on the selected date"
      );
    }

    // ------------------------------------------------------------------------
    // Branch timing for this day of week
    // ------------------------------------------------------------------------

    const dayOfWeek = appointmentDate.getUTCDay(); // 0 = Sunday .. 6 = Saturday

    const timing = await prisma.branchTiming.findFirst({
      where: { branchId, dayOfWeek },
    });

    if (!timing || !timing.isOpen) {
      return ok(
        { branch, service, worker, date, slots: [] },
        "Branch is closed on the selected date"
      );
    }

    const openMinutes = timeToMinutes(timing.openTime);
    const closeMinutes = timeToMinutes(timing.closeTime);
    const duration = service.duration; // minutes

    // ------------------------------------------------------------------------
    // Candidate workers: the one requested, or every worker who can perform
    // this service at this branch (if no specific worker was requested).
    // ------------------------------------------------------------------------

    const candidateWorkerIds: string[] = worker
      ? [worker.id]
      : (
          await prisma.workerService.findMany({
            where: { serviceId },
            select: { workerId: true },
          })
        ).map((w) => w.workerId);

    if (candidateWorkerIds.length === 0) {
      return ok(
        { branch, service, worker, date, slots: [] },
        "No workers available for this service"
      );
    }

    // ------------------------------------------------------------------------
    // Existing appointments + blocked availability for candidate workers on
    // this date, fetched once and reused for every candidate slot check.
    // ------------------------------------------------------------------------

    const [existingAppointments, blockedRanges] = await Promise.all([
      prisma.appointment.findMany({
        where: {
          branchId,
          workerId: { in: candidateWorkerIds },
          appointmentDate,
          status: { notIn: [...NON_BLOCKING_STATUSES] },
        },
        select: { workerId: true, startTime: true, endTime: true },
      }),
      prisma.workerAvailability.findMany({
        where: {
          workerId: { in: candidateWorkerIds },
          date: appointmentDate,
        },
        select: { workerId: true, startTime: true, endTime: true },
      }),
    ]);

    const busyByWorker = new Map<string, Array<[number, number]>>();
    for (const wId of candidateWorkerIds) busyByWorker.set(wId, []);

    for (const a of existingAppointments) {
      if (!a.workerId) continue;
      busyByWorker.get(a.workerId)?.push([timeToMinutes(a.startTime), timeToMinutes(a.endTime)]);
    }
    for (const b of blockedRanges) {
      if (!b.workerId) continue;
      busyByWorker.get(b.workerId)?.push([timeToMinutes(b.startTime), timeToMinutes(b.endTime)]);
    }

    // If it's today, don't offer slots that have already passed.
    const nowMinutes =
      date === todayStr
        ? new Date().getUTCHours() * 60 + new Date().getUTCMinutes()
        : -1;

    // ------------------------------------------------------------------------
    // Generate slots
    // ------------------------------------------------------------------------

    const slots: string[] = [];

    for (
      let slotStart = openMinutes;
      slotStart + duration <= closeMinutes;
      slotStart += SLOT_INTERVAL_MINUTES
    ) {
      if (slotStart <= nowMinutes) continue;

      const slotEnd = slotStart + duration;

      const isAnyWorkerFree = candidateWorkerIds.some((wId) => {
        const busy = busyByWorker.get(wId) ?? [];
        return !busy.some(([bStart, bEnd]) => rangesOverlap(slotStart, slotEnd, bStart, bEnd));
      });

      if (isAnyWorkerFree) {
        slots.push(minutesToTime(slotStart));
      }
    }

    return ok({ branch, service, worker, date, slots }, "Available slots fetched successfully");
  } catch (error) {
    console.error("GET Public Slots Error:", error);
    return err("Internal server error", 500);
  }
}