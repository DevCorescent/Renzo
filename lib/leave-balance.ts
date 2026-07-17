import type { LeaveStatus, Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/** Inclusive calendar-day count between two dates. */
export function leaveDays(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

async function ensureBalance(
  tx: Tx,
  workerId: string,
  leaveTypeId: string,
  year: number,
  allocatedDefault: number
) {
  return tx.leaveBalance.upsert({
    where: {
      workerId_leaveTypeId_year: { workerId, leaveTypeId, year },
    },
    create: {
      workerId,
      leaveTypeId,
      year,
      allocated: allocatedDefault,
      used: 0,
      pending: 0,
      remaining: allocatedDefault,
    },
    update: {},
  });
}

function recomputeRemaining(allocated: number, used: number, pending: number) {
  return Math.max(0, allocated - used - pending);
}

/** Apply balance deltas when leave status changes. */
export async function adjustLeaveBalance(
  tx: Tx,
  opts: {
    workerId: string;
    leaveTypeId: string;
    days: number;
    year: number;
    from: LeaveStatus | null;
    to: LeaveStatus;
    maxPerYear?: number;
  }
) {
  const bal = await ensureBalance(
    tx,
    opts.workerId,
    opts.leaveTypeId,
    opts.year,
    opts.maxPerYear ?? 12
  );

  let used = bal.used;
  let pending = bal.pending;

  const clearFrom = (s: LeaveStatus | null) => {
    if (s === "PENDING") pending = Math.max(0, pending - opts.days);
    if (s === "APPROVED") used = Math.max(0, used - opts.days);
  };

  clearFrom(opts.from);

  if (opts.to === "PENDING") pending += opts.days;
  if (opts.to === "APPROVED") used += opts.days;
  // REJECTED / CANCELLED: only clearFrom applies

  const remaining = recomputeRemaining(bal.allocated, used, pending);

  await tx.leaveBalance.update({
    where: { id: bal.id },
    data: { used, pending, remaining },
  });
}
