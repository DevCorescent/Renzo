import prisma from "@/lib/db";
import { resolveShift, WORKER_SHIFT_SELECT } from "@/lib/scheduling";
import { salonNow } from "@/lib/branch-hours";

// OWNER: Aman | MODULE: Scheduling — worker-specific slot generation
// Single source of truth for "which slots is a worker free for?". Both
// /api/v1/public/slots and the worker-picker cards (/api/v1/public/workers)
// call this, so the availability a customer sees on a worker card and the
// slots they can actually book can never drift apart.
//
// Availability for a worker on a date = branch open hours
//   INTERSECT their WorkerShift / Shift window (when a roster exists)
//   MINUS their existing appointments (any status except CANCELLED / NO_SHOW)
//   MINUS their WorkerAvailability blocks (null fromTime/toTime = whole day)
//   MINUS approved Leave (whole day)
//   MINUS shift breaks
//   MINUS slots already in the past (when the date is today).
//
// Workers with no shift assignment keep the previous public behaviour: the
// full branch window. A rostered worker who is off that weekday yields no slots.

export const SLOT_INTERVAL_MINUTES = 30;

// Statuses that free the chair back up — everything else blocks the slot.
export const NON_BLOCKING_STATUSES = ["CANCELLED", "NO_SHOW"] as const;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Bookable window = branch hours ∩ worker hours.
 * `worker === null` means no roster at this branch → keep branch hours (existing
 * public behaviour). `notRostered` means they hold a shift but not on this weekday.
 */
export function effectiveBookableWindow(opts: {
  branchOpen: number;
  branchClose: number;
  worker: { start: number; end: number } | null;
  notRostered: boolean;
}): { start: number; end: number } | null {
  if (!(opts.branchClose > opts.branchOpen)) return null;
  if (opts.notRostered) return null;
  if (!opts.worker) {
    return { start: opts.branchOpen, end: opts.branchClose };
  }
  const start = Math.max(opts.branchOpen, opts.worker.start);
  const end = Math.min(opts.branchClose, opts.worker.end);
  if (!(end > start)) return null;
  return { start, end };
}

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

  const [appointments, blocks, shiftRows, leaves] = await Promise.all([
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
    prisma.workerShift.findMany({
      where: {
        workerId: { in: workerIds },
        branchId,
        isActive: true,
        startDate: { lte: appointmentDate },
        OR: [{ endDate: null }, { endDate: { gte: appointmentDate } }],
      },
      orderBy: [{ startDate: "desc" }, { id: "asc" }],
      select: { workerId: true, ...WORKER_SHIFT_SELECT },
    }),
    prisma.leave.findMany({
      where: {
        workerId: { in: workerIds },
        status: "APPROVED",
        startDate: { lte: appointmentDate },
        endDate: { gte: appointmentDate },
      },
      select: { workerId: true },
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

  const shiftsByWorker = new Map<string, typeof shiftRows>();
  for (const row of shiftRows) {
    const list = shiftsByWorker.get(row.workerId) ?? [];
    list.push(row);
    shiftsByWorker.set(row.workerId, list);
  }
  const onLeave = new Set(leaves.map((l) => l.workerId));
  const dayOfWeek = appointmentDate.getUTCDay();

  // Don't offer slots that have already passed today.
  //
  // Slot times are salon wall-clock ("14:30"), so "now" has to be read in the
  // salon's zone too. Comparing against getUTCHours() left the cut-off trailing
  // real time by the UTC offset — in IST that meant times up to 5.5 hours in
  // the past were still offered as bookable.
  const { minutes: salonMinutes, dateKey: salonToday } = salonNow();
  const nowMinutes = date === salonToday ? salonMinutes : -1;

  const byWorker = new Map<string, string[]>();
  const gridByWorker = new Map<string, SlotEntry[]>();

  for (const workerId of workerIds) {
    const ranges = [...(busy.get(workerId) ?? [])];
    const free: string[] = [];
    const grid: SlotEntry[] = [];

    if (onLeave.has(workerId)) {
      byWorker.set(workerId, free);
      gridByWorker.set(workerId, grid);
      continue;
    }

    const roster = shiftsByWorker.get(workerId) ?? [];
    const resolved = roster.length > 0 ? resolveShift(roster, dayOfWeek) : null;
    const notRostered = roster.length > 0 && (!resolved || !resolved.isRosteredToday || !resolved.window);
    const workerWindow =
      resolved?.window && resolved.isRosteredToday
        ? { start: resolved.window.start, end: resolved.window.end }
        : null;
    const window = effectiveBookableWindow({
      branchOpen: openMinutes,
      branchClose: closeMinutes,
      worker: workerWindow,
      notRostered,
    });

    if (resolved?.breakWindow) {
      ranges.push([resolved.breakWindow.start, resolved.breakWindow.end]);
    }

    if (!window) {
      byWorker.set(workerId, free);
      gridByWorker.set(workerId, grid);
      continue;
    }

    for (
      let start = window.start;
      start + durationMinutes <= window.end;
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
/**
 * Service ids from a request, accepting either `serviceId=a` or a repeated /
 * comma-separated `serviceIds=a,b`. Shared with /api/v1/public/workers so the
 * stylist list and the slot list can never disagree about what was asked for.
 */
export function parseRequestedServiceIds(url: URL): string[] {
  const collected: string[] = [];
  const single = url.searchParams.get("serviceId")?.trim();
  if (single) collected.push(single);
  for (const raw of url.searchParams.getAll("serviceIds")) {
    for (const part of raw.split(",")) {
      const id = part.trim();
      if (id) collected.push(id);
    }
  }
  return [...new Set(collected)];
}

/**
 * Workers at `branchId` who can perform EVERY requested service.
 *
 * With several services this must be an intersection, not a union: a booking
 * for "Oil Massage + Pedicure" is one appointment handled by one stylist, so a
 * stylist who only does one of them cannot take it.
 */
export async function eligibleWorkerIds(params: {
  branchId: string;
  serviceId?: string;
  serviceIds?: string[];
}): Promise<string[]> {
  const ids = [
    ...new Set(
      [...(params.serviceIds ?? []), ...(params.serviceId ? [params.serviceId] : [])].filter(
        Boolean,
      ),
    ),
  ];
  if (ids.length === 0) return [];

  const rows = await prisma.workerService.findMany({
    where: {
      serviceId: { in: ids },
      isActive: true,
      worker: {
        isActive: true,
        branches: { some: { branchId: params.branchId, isActive: true } },
      },
    },
    select: { workerId: true, serviceId: true },
  });

  const offered = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = offered.get(r.workerId) ?? new Set<string>();
    set.add(r.serviceId);
    offered.set(r.workerId, set);
  }

  return [...offered.entries()]
    .filter(([, set]) => ids.every((id) => set.has(id)))
    .map(([workerId]) => workerId);
}
