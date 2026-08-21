import { z } from "zod";
import prisma from "@/lib/db";
import { err } from "@/lib/response";
import { timeToMinutes } from "@/lib/scheduling";
import { normalizeWorkingDays } from "@/lib/shift-schema";
import type { AuthUser } from "@/types/api";

// ============================================================================
// Worker working hours — source of truth is the existing Shift + WorkerShift
// roster. WorkerAvailability remains subtractive (day-off / blocked windows).
// ============================================================================

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const TimeField = z.string().trim().regex(HHMM, "Must be HH:mm (00:00–23:59)");

export const WorkerHoursSchema = z
  .object({
    startTime: TimeField,
    endTime: TimeField,
    workingDays: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Select at least one working day")
      .max(7),
    breakStart: TimeField.nullable().optional(),
    breakEnd: TimeField.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    const start = timeToMinutes(value.startTime);
    const end = timeToMinutes(value.endTime);
    if (!(end > start)) {
      ctx.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time must be after start time",
      });
    }

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

    const breakStart = timeToMinutes(value.breakStart);
    const breakEnd = timeToMinutes(value.breakEnd);
    if (!(breakEnd > breakStart)) {
      ctx.addIssue({
        code: "custom",
        path: ["breakEnd"],
        message: "Break end must be after break start",
      });
      return;
    }
    if (end > start && (breakStart < start || breakEnd > end)) {
      ctx.addIssue({
        code: "custom",
        path: ["breakStart"],
        message: "The break must fall inside the working window",
      });
    }
  });

export type WorkerHoursInput = z.infer<typeof WorkerHoursSchema>;

export type WorkerHoursRecord = {
  assigned: boolean;
  startTime: string;
  endTime: string;
  workingDays: number[];
  breakStart: string | null;
  breakEnd: string | null;
  branchId: string | null;
  branchName: string | null;
  shiftId: string | null;
  shiftName: string | null;
};

const HOURS_SELECT = {
  id: true,
  startDate: true,
  endDate: true,
  isActive: true,
  branch: { select: { id: true, name: true } },
  shift: {
    select: {
      id: true,
      name: true,
      startTime: true,
      endTime: true,
      breakStart: true,
      breakEnd: true,
      workingDays: true,
      isActive: true,
    },
  },
} as const;

function personalShiftName(employeeCode: string): string {
  const name = `Personal · ${employeeCode}`;
  return name.slice(0, 60);
}

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function authorizeHoursAccess(
  user: AuthUser,
  workerId: string
): Promise<
  | { worker: { id: string }; error: null }
  | { worker: null; error: ReturnType<typeof err> }
> {
  if (user.userType === "WORKER") {
    if (!user.workerId || user.workerId !== workerId) {
      return {
        worker: null,
        error: err("Forbidden — you can only manage your own hours", 403),
      };
    }
    const self = await prisma.workerProfile.findUnique({
      where: { id: workerId },
      select: { id: true },
    });
    if (!self) return { worker: null, error: err("Worker not found", 404) };
    return { worker: { id: self.id }, error: null };
  }

  if (user.userType !== "SUPER_ADMIN" && user.userType !== "OWNER" && user.userType !== "BRANCH_ADMIN") {
    return { worker: null, error: err("Forbidden — insufficient role", 403) };
  }

  if (user.userType === "BRANCH_ADMIN" && !user.branchId) {
    return {
      worker: null,
      error: err("Your account is not assigned to a branch", 403),
    };
  }

  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    select: {
      id: true,
      branches: { select: { branchId: true, isActive: true } },
    },
  });

  if (!worker) return { worker: null, error: err("Worker not found", 404) };

  if (
    user.userType === "BRANCH_ADMIN" &&
    !worker.branches.some((b) => b.branchId === user.branchId && b.isActive)
  ) {
    return {
      worker: null,
      error: err("Forbidden — worker belongs to another branch", 403),
    };
  }

  return { worker: { id: worker.id }, error: null };
}

async function resolveHoursBranchId(
  user: AuthUser,
  workerId: string
): Promise<{ branchId: string; error: null } | { branchId: null; error: ReturnType<typeof err> }> {
  if (user.userType === "BRANCH_ADMIN") {
    if (!user.branchId) {
      return { branchId: null, error: err("Your account is not assigned to a branch", 403) };
    }
    return { branchId: user.branchId, error: null };
  }

  const membership = await prisma.workerBranch.findFirst({
    where: { workerId, isActive: true },
    orderBy: { isPrimary: "desc" },
    select: { branchId: true },
  });
  if (!membership) {
    return {
      branchId: null,
      error: err("Worker is not assigned to any branch, so hours cannot be saved", 409),
    };
  }
  return { branchId: membership.branchId, error: null };
}

export async function getWorkerHours(
  workerId: string,
  branchId?: string | null
): Promise<WorkerHoursRecord> {
  const empty: WorkerHoursRecord = {
    assigned: false,
    startTime: "09:00",
    endTime: "18:00",
    workingDays: [1, 2, 3, 4, 5, 6],
    breakStart: null,
    breakEnd: null,
    branchId: branchId ?? null,
    branchName: null,
    shiftId: null,
    shiftName: null,
  };

  const row = await prisma.workerShift.findFirst({
    where: {
      workerId,
      isActive: true,
      ...(branchId ? { branchId } : {}),
    },
    orderBy: [{ startDate: "desc" }, { id: "asc" }],
    select: HOURS_SELECT,
  });

  if (!row) return empty;

  return {
    assigned: true,
    startTime: row.shift.startTime,
    endTime: row.shift.endTime,
    workingDays: row.shift.workingDays,
    breakStart: row.shift.breakStart,
    breakEnd: row.shift.breakEnd,
    branchId: row.branch.id,
    branchName: row.branch.name,
    shiftId: row.shift.id,
    shiftName: row.shift.name,
  };
}

export async function upsertWorkerHours(
  user: AuthUser,
  workerId: string,
  input: WorkerHoursInput
): Promise<
  | { hours: WorkerHoursRecord; error: null }
  | { hours: null; error: ReturnType<typeof err> }
> {
  const { error: accessError } = await authorizeHoursAccess(user, workerId);
  if (accessError) return { hours: null, error: accessError };

  const branch = await resolveHoursBranchId(user, workerId);
  if (branch.error) return { hours: null, error: branch.error };

  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    select: { id: true, employeeCode: true },
  });
  if (!worker) return { hours: null, error: err("Worker not found", 404) };

  const workingDays = normalizeWorkingDays(input.workingDays);
  const shiftData = {
    startTime: input.startTime,
    endTime: input.endTime,
    breakStart: input.breakStart ?? null,
    breakEnd: input.breakEnd ?? null,
    workingDays,
    isActive: true,
  };
  const name = personalShiftName(worker.employeeCode);

  await prisma.$transaction(async (tx) => {
    const existingPersonal = await tx.shift.findFirst({
      where: { name },
      select: { id: true },
    });

    const shift = existingPersonal
      ? await tx.shift.update({
          where: { id: existingPersonal.id },
          data: shiftData,
        })
      : await tx.shift.create({
          data: { name, graceMinutes: 10, ...shiftData },
        });

    await tx.workerShift.updateMany({
      where: {
        workerId,
        branchId: branch.branchId,
        isActive: true,
        NOT: { shiftId: shift.id },
      },
      data: { isActive: false },
    });

    const assignment = await tx.workerShift.findFirst({
      where: { workerId, shiftId: shift.id, branchId: branch.branchId },
      select: { id: true },
    });

    if (assignment) {
      await tx.workerShift.update({
        where: { id: assignment.id },
        data: { isActive: true, endDate: null },
      });
    } else {
      await tx.workerShift.create({
        data: {
          workerId,
          shiftId: shift.id,
          branchId: branch.branchId,
          startDate: utcToday(),
          endDate: null,
          isActive: true,
        },
      });
    }
  });

  const hours = await getWorkerHours(workerId, branch.branchId);
  return { hours, error: null };
}
