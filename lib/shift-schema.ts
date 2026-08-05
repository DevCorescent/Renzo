// ============================================================================
// MODULE : Shift Management — shared validation and select shapes
//
// Lives in lib/ rather than being exported from a route: a Next.js `route.ts` may
// only export HTTP method handlers and the framework's own route config, so
// sharing a schema between /admin/shifts and /admin/shifts/[id] through one of
// them would be exporting something the router does not permit.
// ============================================================================

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { timeToMinutes } from "@/lib/scheduling";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const TimeField = z.string().trim().regex(HHMM, "Must be HH:mm (00:00–23:59)");

/**
 * A shift template. Used unchanged by both create and update, so a shift can
 * never be EDITED into a state creation would have rejected.
 */
export const ShiftSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(60),
    startTime: TimeField,
    endTime: TimeField,
    breakStart: TimeField.nullable().optional(),
    breakEnd: TimeField.nullable().optional(),
    workingDays: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Select at least one working day")
      .max(7),
    graceMinutes: z.number().int().min(0).max(120).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    // A break needs both ends or neither — one alone cannot describe an interval,
    // and the engine would silently ignore it.
    const hasStart = Boolean(value.breakStart);
    const hasEnd = Boolean(value.breakEnd);

    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: "custom",
        path: [hasStart ? "breakEnd" : "breakStart"],
        message: "Provide both break start and break end, or neither",
      });
      return;
    }

    if (!value.breakStart || !value.breakEnd) return;

    const start = timeToMinutes(value.startTime);
    const end = timeToMinutes(value.endTime);
    const breakStart = timeToMinutes(value.breakStart);
    const breakEnd = timeToMinutes(value.breakEnd);

    if (breakEnd <= breakStart) {
      ctx.addIssue({
        code: "custom",
        path: ["breakEnd"],
        message: "Break end must be after break start",
      });
      return;
    }

    // Containment is only meaningful for a same-day shift. An overnight shift
    // (22:00 → 06:00) has a window minutes-past-midnight cannot express; the
    // attendance engine anchors that onto real dates instead.
    if (end > start && (breakStart < start || breakEnd > end)) {
      ctx.addIssue({
        code: "custom",
        path: ["breakStart"],
        message: "The break must fall inside the shift window",
      });
    }
  });

export type ShiftInput = z.infer<typeof ShiftSchema>;

/** List/detail projection. `_count` drives the "in use" guard on delete. */
export const SHIFT_SELECT = {
  id: true,
  name: true,
  startTime: true,
  endTime: true,
  breakStart: true,
  breakEnd: true,
  workingDays: true,
  graceMinutes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { workerShifts: true, attendances: true } },
} satisfies Prisma.ShiftSelect;

export type ShiftRecord = Prisma.ShiftGetPayload<{ select: typeof SHIFT_SELECT }>;

/** Normalise the weekday set so [3,1,1] and [1,3] store identically. */
export function normalizeWorkingDays(days: number[]): number[] {
  return [...new Set(days)].sort((a, b) => a - b);
}
