import prisma from "@/lib/db";
import { NON_BLOCKING_STATUSES, timeToMinutes } from "@/lib/slots";

// Shared overlap checks used when creating or moving an appointment so
// public booking, admin edits, and worker edits all refuse the same clashes.

export function addMinutesToTime(start: string, mins: number): string {
  const total = timeToMinutes(start) + mins;
  const h = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const m = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function durationMinutesBetween(start: string, end: string): number {
  return Math.max(timeToMinutes(end) - timeToMinutes(start), 0);
}

/** Returns an error message if the slot conflicts, otherwise null. */
export async function findAppointmentConflict(params: {
  workerId: string | null | undefined;
  appointmentDate: Date;
  startTime: string;
  endTime: string;
  /** Exclude this appointment (when editing / rescheduling). */
  excludeAppointmentId?: string;
}): Promise<string | null> {
  const { workerId, appointmentDate, startTime, endTime, excludeAppointmentId } =
    params;

  if (!workerId) return null;

  const overlapping = await prisma.appointment.count({
    where: {
      workerId,
      appointmentDate,
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      status: { notIn: [...NON_BLOCKING_STATUSES] },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });

  if (overlapping > 0) {
    return "That time overlaps another booking for this stylist";
  }

  const dateStr = appointmentDate.toISOString().slice(0, 10);
  const blocked = await prisma.workerAvailability.count({
    where: {
      workerId,
      date: new Date(`${dateStr}T00:00:00.000Z`),
      OR: [
        // Partial-day blocks that overlap the slot
        {
          AND: [
            { fromTime: { not: null } },
            { toTime: { not: null } },
            { fromTime: { lt: endTime } },
            { toTime: { gt: startTime } },
          ],
        },
        // Whole-day blocks (null range)
        { fromTime: null, toTime: null },
      ],
    },
  });

  if (blocked > 0) {
    return "The stylist has marked this time as unavailable";
  }

  return null;
}
