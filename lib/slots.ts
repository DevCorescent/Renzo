import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Scheduling — worker-specific slot generation
// Single source of truth for "which slots is a worker free for?". Both
// /api/v1/public/slots and the worker-picker cards (/api/v1/public/workers)
// call this, so the availability a customer sees on a worker card and the
// slots they can actually book can never drift apart.
//
// Availability for a worker on a date = branch open hours
//   MINUS their existing appointments (any status except CANCELLED / NO_SHOW)
//   MINUS their WorkerAvailability blocks (null fromTime/toTime = whole day)
//   MINUS slots already in the past (when the date is today).

export const SLOT_INTERVAL_MINUTES = 30;

// Statuses that free the chair back up — everything else blocks the slot.
export const NON_BLOCKING_STATUSES = ["CANCELLED", "NO_SHOW"] as const;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export type SlotStatus = "AVAILABLE" | "BOOKED" | "PAST";

export type SlotEntry = {
  time: string;
  status: SlotStatus;
};

export type WorkerSlots = {
  /** Branch is shut that day (holiday or no open timing) — nobody is bookable. */
  closed: boolean;
  /** workerId → free start times ("HH:mm"), ascending. */
  byWorker: Map<string, string[]>;
  /** workerId → every open-hour slot with status (available / booked / past). */
  gridByWorker: Map<string, SlotEntry[]>;
};

// Free slots for each given worker at one branch on one date.
export async function getWorkerSlots(params: {
  branchId: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
  workerIds: string[];
}): Promise<WorkerSlots> {
  const { branchId, date, durationMinutes, workerIds } = params;

  const empty = (): WorkerSlots => ({
    closed: true,
    byWorker: new Map(workerIds.map((id) => [id, []])),
    gridByWorker: new Map(workerIds.map((id) => [id, []])),
  });

  if (workerIds.length === 0) {
    return { closed: false, byWorker: new Map(), gridByWorker: new Map() };
  }

  const appointmentDate = new Date(`${date}T00:00:00.000Z`);

  const [holiday, timing] = await Promise.all([
    prisma.branchHoliday.findFirst({ where: { branchId, date: appointmentDate } }),
    prisma.branchTiming.findFirst({
      where: { branchId, dayOfWeek: appointmentDate.getUTCDay() },
    }),
  ]);

  if (holiday || !timing || !timing.isOpen) return empty();

  const openMinutes = timeToMinutes(timing.openTime);
  const closeMinutes = timeToMinutes(timing.closeTime);

  const [appointments, blocks] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        branchId,
        workerId: { in: workerIds },
        appointmentDate,
        status: { notIn: [...NON_BLOCKING_STATUSES] },
      },
      select: { workerId: true, startTime: true, endTime: true },
    }),
    prisma.workerAvailability.findMany({
      where: { workerId: { in: workerIds }, date: appointmentDate },
      select: { workerId: true, fromTime: true, toTime: true },
    }),
  ]);

  const busy = new Map<string, Array<[number, number]>>();
  for (const id of workerIds) busy.set(id, []);

  for (const a of appointments) {
    if (!a.workerId) continue;
    busy.get(a.workerId)?.push([timeToMinutes(a.startTime), timeToMinutes(a.endTime)]);
  }
  for (const b of blocks) {
    // fromTime/toTime are nullable: null means the whole day is blocked.
    const from = b.fromTime ? timeToMinutes(b.fromTime) : 0;
    const to = b.toTime ? timeToMinutes(b.toTime) : 24 * 60;
    busy.get(b.workerId)?.push([from, to]);
  }

  // Don't offer slots that have already passed today.
  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const nowMinutes =
    date === todayStr ? now.getUTCHours() * 60 + now.getUTCMinutes() : -1;

  const byWorker = new Map<string, string[]>();
  const gridByWorker = new Map<string, SlotEntry[]>();

  for (const workerId of workerIds) {
    const ranges = busy.get(workerId) ?? [];
    const free: string[] = [];
    const grid: SlotEntry[] = [];

    for (
      let start = openMinutes;
      start + durationMinutes <= closeMinutes;
      start += SLOT_INTERVAL_MINUTES
    ) {
      const time = minutesToTime(start);
      if (start <= nowMinutes) {
        grid.push({ time, status: "PAST" });
        continue;
      }
      const end = start + durationMinutes;
      const clash = ranges.some(([bs, be]) => rangesOverlap(start, end, bs, be));
      if (clash) {
        grid.push({ time, status: "BOOKED" });
      } else {
        free.push(time);
        grid.push({ time, status: "AVAILABLE" });
      }
    }

    byWorker.set(workerId, free);
    gridByWorker.set(workerId, grid);
  }

  return { closed: false, byWorker, gridByWorker };
}

// Workers who can actually take this booking: active, at this branch, and
// qualified for this service. This is the gate behind BOTH the worker picker
// and the slot API — a worker who cannot perform the service is never offered.
export async function eligibleWorkerIds(params: {
  branchId: string;
  serviceId: string;
}): Promise<string[]> {
  const rows = await prisma.workerService.findMany({
    where: {
      serviceId: params.serviceId,
      isActive: true,
      worker: {
        isActive: true,
        branches: { some: { branchId: params.branchId, isActive: true } },
      },
    },
    select: { workerId: true },
  });
  return rows.map((r) => r.workerId);
}
