// ============================================================================
// MODULE : System health — the Prisma-facing half
//
// Answers "what will break for staff today, before they hit it". Every check is
// branch-scoped through the same `branchWhere(scope)` the rest of the system
// uses, so a branch admin sees their own branch's health and a platform role
// sees the business.
//
// Deliberately READ-ONLY and count-based: this runs on a dashboard, so it must
// stay a handful of indexed aggregates rather than loading tables into memory.
// ============================================================================

import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";
import { branchWhere, type BranchScope } from "@/lib/branch-scope";
import { attendanceDateKey } from "@/lib/attendance";
import {
  assessWorker,
  summariseReadiness,
  type WorkerReadiness,
} from "@/lib/worker-readiness";

/**
 * Exactly the columns readiness is computed from — shared so the list view and
 * the single-worker check can never diverge on what "ready" means.
 */
const READINESS_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
  employeeCode: true,
  isActive: true,
  _count: {
    select: {
      branches: { where: { isActive: true } },
      services: { where: { isActive: true } },
      shifts: { where: { isActive: true } },
    },
  },
  // Only the working days are needed, not the whole roster.
  shifts: {
    where: { isActive: true },
    select: { shift: { select: { workingDays: true } } },
  },
} satisfies Prisma.WorkerProfileSelect;

type ReadinessRow = Prisma.WorkerProfileGetPayload<{ select: typeof READINESS_SELECT }>;

function toReadiness(w: ReadinessRow): WorkerReadiness {
  return assessWorker({
    id: w.id,
    name: w.displayName?.trim() || `${w.firstName} ${w.lastName ?? ""}`.trim(),
    employeeCode: w.employeeCode,
    isActive: w.isActive,
    branchCount: w._count.branches,
    serviceCount: w._count.services,
    shiftCount: w._count.shifts,
    workingDays: [...new Set(w.shifts.flatMap((ws) => ws.shift.workingDays))],
  });
}

/** Every worker in scope, with the counts readiness depends on. */
export async function loadWorkerReadiness(scope: BranchScope): Promise<WorkerReadiness[]> {
  const branch = branchWhere(scope) as { branchId?: string };

  const workers = await prisma.workerProfile.findMany({
    where: branch.branchId
      ? { branches: { some: { branchId: branch.branchId, isActive: true } } }
      : {},
    orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
    select: READINESS_SELECT,
  });

  return workers.map(toReadiness);
}

/**
 * One worker's readiness, for the check that runs BEFORE they are published as
 * bookable. Null when the worker does not exist — the caller already knows
 * whether that is a 404 or a race.
 */
export async function loadOneWorkerReadiness(workerId: string): Promise<WorkerReadiness | null> {
  const worker = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    select: READINESS_SELECT,
  });

  return worker ? toReadiness(worker) : null;
}

export type HealthReport = {
  branchLabel: string;
  workers: ReturnType<typeof summariseReadiness>;
  /** Workers who cannot be booked at all, worst first. */
  blockedWorkers: WorkerReadiness[];
  inventory: { lowStock: number; outOfStock: number };
  billing: { pendingBills: number; unpaidTotal: number; partiallyPaid: number };
  operations: { pendingApprovals: number; unassignedToday: number; conflictsToday: number };
  data: { duplicatePhones: number; expiredMemberships: number };
  notifications: { failed: number };
  config: { taxUnset: boolean; noPaymentRail: boolean; branchesMissingSettings: number };
};

/**
 * One pass over everything a manager should fix before staff meet it.
 *
 * All counts run in parallel; none of them loads a table.
 */
export async function loadHealthReport(
  scope: BranchScope,
  branchLabel: string
): Promise<HealthReport> {
  const branch = branchWhere(scope) as { branchId?: string };
  const scoped = branch.branchId ? { branchId: branch.branchId } : {};
  const today = attendanceDateKey();

  const [
    readiness,
    lowStock,
    outOfStock,
    pendingBills,
    unpaidAgg,
    partiallyPaid,
    pendingApprovals,
    unassignedToday,
    todaysAppointments,
    expiredMemberships,
    failedNotifications,
    settingsRows,
    branchCount,
  ] = await Promise.all([
    loadWorkerReadiness(scope),
    // "Low" is relative to each product's own reorder level, which is why this
    // is a raw query — Prisma cannot compare two columns in a where clause.
    prisma.$queryRawUnsafe<{ count: bigint }[]>(
      branch.branchId
        ? `SELECT COUNT(*)::bigint AS count FROM stocks s
           JOIN products p ON p.id = s."productId"
           WHERE s."branchId" = $1 AND s.quantity > 0 AND s.quantity <= p."reorderLevel"`
        : `SELECT COUNT(*)::bigint AS count FROM stocks s
           JOIN products p ON p.id = s."productId"
           WHERE s.quantity > 0 AND s.quantity <= p."reorderLevel"`,
      ...(branch.branchId ? [branch.branchId] : [])
    ),
    prisma.stock.count({ where: { ...scoped, quantity: { lte: 0 } } }),
    prisma.invoice.count({ where: { ...scoped, status: { in: ["UNPAID", "PARTIAL"] } } }),
    prisma.invoice.aggregate({
      where: { ...scoped, status: { in: ["UNPAID", "PARTIAL"] } },
      _sum: { balanceDue: true },
    }),
    prisma.invoice.count({ where: { ...scoped, status: "PARTIAL" } }),
    prisma.attendance.count({ where: { ...scoped, isManual: true, approvedAt: null } }),
    prisma.appointment.count({
      where: {
        ...scoped,
        appointmentDate: today,
        workerId: null,
        status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
      },
    }),
    // Loaded (not counted) so overlaps can be detected in memory — a self-join
    // for this is far more expensive than one day's rows.
    prisma.appointment.findMany({
      where: {
        ...scoped,
        appointmentDate: today,
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        workerId: { not: null },
      },
      select: { workerId: true, startTime: true, endTime: true },
    }),
    prisma.customerMembership.count({
      where: { status: "ACTIVE", endDate: { lt: new Date() } },
    }),
    prisma.notificationLog.count({ where: { status: "FAILED" } }),
    prisma.branchSetting.findMany({
      where: branch.branchId ? { branchId: branch.branchId } : {},
      select: { taxPercent: true, onlinePaymentEnabled: true, offlinePaymentEnabled: true },
    }),
    prisma.branch.count({ where: branch.branchId ? { id: branch.branchId } : { isActive: true } }),
  ]);

  // Two bookings for the same stylist whose times overlap. Half-open, so a
  // booking ending exactly when the next starts is not a clash.
  const byWorker = new Map<string, { startTime: string; endTime: string }[]>();
  for (const a of todaysAppointments) {
    if (!a.workerId) continue;
    const list = byWorker.get(a.workerId) ?? [];
    list.push({ startTime: a.startTime, endTime: a.endTime });
    byWorker.set(a.workerId, list);
  }
  let conflictsToday = 0;
  for (const list of byWorker.values()) {
    const sorted = [...list].sort((x, y) => x.startTime.localeCompare(y.startTime));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startTime < sorted[i - 1].endTime) conflictsToday++;
    }
  }

  // Two live customers sharing a phone. Only counted, never auto-merged —
  // deciding which record is the real one is a human's call.
  const dupRows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::bigint AS count FROM (
       SELECT RIGHT(REGEXP_REPLACE(phone, '\\D', '', 'g'), 10) AS tail
       FROM customers
       WHERE "deletedAt" IS NULL AND phone IS NOT NULL AND phone <> ''
       GROUP BY 1 HAVING COUNT(*) > 1
     ) d`
  );

  return {
    branchLabel,
    workers: summariseReadiness(readiness),
    blockedWorkers: readiness.filter((r) => !r.bookable).slice(0, 20),
    inventory: { lowStock: Number(lowStock[0]?.count ?? 0), outOfStock },
    billing: {
      pendingBills,
      unpaidTotal: unpaidAgg._sum.balanceDue ?? 0,
      partiallyPaid,
    },
    operations: { pendingApprovals, unassignedToday, conflictsToday },
    data: {
      duplicatePhones: Number(dupRows[0]?.count ?? 0),
      expiredMemberships,
    },
    notifications: { failed: failedNotifications },
    config: {
      taxUnset: settingsRows.some((s) => s.taxPercent === 0),
      noPaymentRail: settingsRows.some(
        (s) => !s.onlinePaymentEnabled && !s.offlinePaymentEnabled
      ),
      branchesMissingSettings: Math.max(0, branchCount - settingsRows.length),
    },
  };
}
