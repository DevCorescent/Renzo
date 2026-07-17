import prisma from "@/lib/db";
import type { AuthUser } from "@/types/api";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Workspace — data layer
//
// PURPOSE
//   The Worker Workspace is the SINGLE enterprise page for a worker, replacing the
//   old scattered detail/schedule/services/… pages. This module loads everything
//   those pages showed, in ONE branch-scoped batch, so the workspace never fires a
//   query per tab and never N+1s: one Promise.all, explicit selects, done.
//
// ARCHITECTURE
//   The existing admin worker pages read Prisma directly (server components), and
//   this follows that same pattern rather than inventing new admin APIs. It only
//   reads models the schema already has — WorkerProfile, WorkerService, Attendance,
//   Leave, LeaveBalance, Appointment, RatingSummary, WorkerPortfolio,
//   PortfolioChangeRequest, AuditLog. Nothing here writes anything.
//
// BRANCH ISOLATION
//   A BRANCH_ADMIN may only open a worker in their OWN branch — enforced through the
//   WorkerBranch join (WorkerProfile has no branchId). SUPER_ADMIN / OWNER are
//   global. Denied / missing → null, so the page answers notFound() without leaking
//   whether the worker exists elsewhere.
// ============================================================================

/** Current-month window, UTC-pinned like every other date in the codebase. */
function monthStartUTC(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

const GLOBAL_ROLES = ["SUPER_ADMIN", "OWNER"];

export type WorkerWorkspaceData = NonNullable<Awaited<ReturnType<typeof getWorkerWorkspace>>>;

/**
 * Load the full workspace for one worker, scoped to the caller. Returns null when
 * the worker does not exist OR is outside a branch admin's branch.
 */
export async function getWorkerWorkspace(workerId: string, user: AuthUser) {
  const isGlobal = GLOBAL_ROLES.includes(user.userType);
  // A worker viewing their OWN profile is always allowed, regardless of branchId.
  const isSelf = user.workerId != null && user.workerId === workerId;

  // Branch gate FIRST: a branch admin with no branch, or a worker not in their
  // branch, is refused before any data is read. Self-view skips the gate.
  if (!isGlobal && !isSelf) {
    if (!user.branchId) return null;
    const link = await prisma.workerBranch.findFirst({
      where: { workerId, branchId: user.branchId, isActive: true },
      select: { id: true },
    });
    if (!link) return null;
  }

  const now = new Date();
  const monthStart = monthStartUTC(now);
  const year = now.getUTCFullYear();

  const [worker, attendance, leaves, leaveGroups, leaveBalances, apptByStatus, revenue, repeatGroups, portfolioItems, requestGroups, activity, recentAppointments] =
    await Promise.all([
      // Overview + Services + Portfolio(skills/certs) + header
      prisma.workerProfile.findUnique({
        where: { id: workerId },
        select: {
          id: true, employeeCode: true, firstName: true, lastName: true, displayName: true,
          bio: true, profilePhoto: true, phone: true, email: true, gender: true, dateOfBirth: true,
          experience: true, languages: true, certificates: true, isActive: true, isPublic: true, joinDate: true,
          designation: { select: { name: true, level: true } },
          department: { select: { name: true } },
          skills: { select: { proficiency: true, skill: { select: { name: true } } }, orderBy: { proficiency: "desc" } },
          services: {
            where: { isActive: true },
            select: { isActive: true, service: { select: { id: true, name: true, duration: true, basePrice: true } } },
          },
          branches: {
            select: { isPrimary: true, isActive: true, branch: { select: { id: true, name: true, city: true } } },
          },
          ratingSummary: { select: { averageRating: true, totalReviews: true } },
        },
      }),
      // Attendance — current month
      prisma.attendance.findMany({
        where: { workerId, date: { gte: monthStart } },
        select: { date: true, status: true, lateMinutes: true, overtimeMinutes: true, workingMinutes: true },
        orderBy: { date: "desc" },
      }),
      // Leaves — recent history
      prisma.leave.findMany({
        where: { workerId },
        select: { id: true, status: true, startDate: true, endDate: true, days: true, reason: true, createdAt: true, leaveType: { select: { name: true, code: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.leave.groupBy({ by: ["status"], where: { workerId }, _count: { _all: true } }),
      prisma.leaveBalance.findMany({
        where: { workerId, year },
        select: { allocated: true, used: true, remaining: true, leaveType: { select: { name: true, code: true } } },
      }),
      // Performance — appointment status counts + revenue + repeat customers
      prisma.appointment.groupBy({ by: ["status"], where: { workerId }, _count: { _all: true } }),
      prisma.appointment.aggregate({ where: { workerId, status: "COMPLETED" }, _sum: { totalAmount: true } }),
      prisma.appointment.groupBy({ by: ["customerId"], where: { workerId, status: "COMPLETED" }, _count: { _all: true } }),
      // Portfolio — approved gallery items
      prisma.workerPortfolio.findMany({
        where: { workerId },
        select: { id: true, category: true, title: true, beforeImage: true, afterImage: true, isApproved: true, createdAt: true },
        orderBy: [{ isApproved: "desc" }, { sortOrder: "asc" }],
      }),
      prisma.portfolioChangeRequest.groupBy({ by: ["status"], where: { workerId }, _count: { _all: true } }),
      // Activity — whatever the audit trail captured for this worker
      prisma.auditLog.findMany({
        where: { refId: workerId },
        select: { id: true, action: true, module: true, createdAt: true, userType: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      // Recent appointments — the profile's "recent work" timeline
      prisma.appointment.findMany({
        where: { workerId },
        orderBy: [{ appointmentDate: "desc" }, { startTime: "desc" }],
        take: 6,
        select: {
          id: true, appointmentNo: true, appointmentDate: true, status: true, totalAmount: true,
          customer: { select: { firstName: true, lastName: true } },
          branch: { select: { name: true } },
          services: { select: { service: { select: { name: true } } } },
        },
      }),
    ]);

  if (!worker) return null;

  // ── Derive header + performance from the raw rows (computed, never stored) ──
  const primary = worker.branches.find((b) => b.isPrimary && b.isActive) ?? worker.branches.find((b) => b.isActive) ?? worker.branches[0] ?? null;

  const leaveCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };
  for (const g of leaveGroups) leaveCounts[g.status] = g._count._all;

  const requestCounts = { PENDING: 0, APPROVED: 0, REJECTED: 0, NEEDS_CHANGES: 0 };
  for (const g of requestGroups) requestCounts[g.status] = g._count._all;

  const statusCount = new Map<string, number>();
  for (const g of apptByStatus) statusCount.set(g.status, g._count._all);
  const totalAppointments = apptByStatus.reduce((sum, g) => sum + g._count._all, 0);
  const completed = statusCount.get("COMPLETED") ?? 0;
  const cancelled = statusCount.get("CANCELLED") ?? 0;
  const noShow = statusCount.get("NO_SHOW") ?? 0;
  const resolved = completed + cancelled + noShow;
  const pct = (num: number, den: number) => (den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0);

  // Attendance snapshot (this month)
  let attended = 0, lateCount = 0, workingMinutes = 0, overtimeMinutes = 0;
  const todayIso = now.toISOString().slice(0, 10);
  let todayStatus = "Not marked";
  for (const r of attendance) {
    if (r.status === "PRESENT" || r.status === "LATE") attended += 1;
    else if (r.status === "HALF_DAY") attended += 0.5;
    if (r.status === "LATE" || r.lateMinutes > 0) lateCount += 1;
    workingMinutes += r.workingMinutes;
    overtimeMinutes += r.overtimeMinutes;
    if (r.date.toISOString().slice(0, 10) === todayIso) todayStatus = r.status;
  }
  const attendancePct = attendance.length > 0 ? Math.round((attended / attendance.length) * 100) : null;

  // Portfolio completion — same six real fields the worker's own manager uses.
  const completionChecks = [
    Boolean(worker.profilePhoto),
    Boolean(worker.bio?.trim()),
    worker.skills.length > 0,
    worker.languages.length > 0,
    worker.certificates.length > 0,
    portfolioItems.length > 0,
  ];
  const portfolioCompletion = Math.round((completionChecks.filter(Boolean).length / completionChecks.length) * 100);

  // Weekly availability = the primary branch's open hours (Mon–Sun). Worker-specific
  // day-off overrides live in WorkerAvailability/shifts; this is the branch baseline.
  const availability = primary
    ? await prisma.branchTiming.findMany({
        where: { branchId: primary.branch.id },
        orderBy: { dayOfWeek: "asc" },
        select: { dayOfWeek: true, isOpen: true, openTime: true, closeTime: true },
      })
    : [];

  return {
    worker,
    primaryBranch: primary?.branch ?? null,
    header: {
      averageRating: worker.ratingSummary?.averageRating ?? 0,
      totalReviews: worker.ratingSummary?.totalReviews ?? 0,
      portfolioCompletion,
    },
    attendance: {
      rows: attendance,
      todayStatus,
      attendancePct,
      workingHours: Math.round((workingMinutes / 60) * 10) / 10,
      overtimeHours: Math.round((overtimeMinutes / 60) * 10) / 10,
      lateCount,
      marked: attendance.length,
    },
    leaves: { rows: leaves, counts: leaveCounts, balances: leaveBalances },
    performance: {
      totalAppointments,
      completedBookings: completed,
      completedServices: completed, // one worker per appointment; completed appts ≈ services delivered
      revenueGenerated: revenue._sum.totalAmount ?? 0,
      repeatCustomers: repeatGroups.filter((g) => g._count._all > 1).length,
      averageRating: worker.ratingSummary?.averageRating ?? 0,
      totalReviews: worker.ratingSummary?.totalReviews ?? 0,
      completionRate: pct(completed, resolved),
      cancellationRate: pct(cancelled + noShow, resolved),
      portfolioCompletion,
    },
    portfolio: { items: portfolioItems, requestCounts },
    recentAppointments,
    availability,
    activity,
  };
}
