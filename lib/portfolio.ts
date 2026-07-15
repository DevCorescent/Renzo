import prisma from "@/lib/db";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Portfolio — calculation engine
//
// PURPOSE
//   The professional identity of a worker is DERIVED, not stored: skill ratings
//   and statistics are computed from the booking + review history every time, so
//   they can never drift from reality or be edited by hand. This module holds
//   those pure calculations so the worker-facing routes stay thin — and so an
//   admin or public route can reuse the exact same numbers by passing a workerId,
//   with no logic copied.
//
// SOURCE OF TRUTH
//   Only existing schema is read: Appointment, AppointmentService, Review,
//   RatingSummary, WorkerService, WorkerProfile. Nothing is invented. Portfolio
//   VIEWS are intentionally absent — there is no counter column/table to read, and
//   a fabricated number would be worse than an honest omission.
//
// PERFORMANCE
//   Every figure is a single aggregate / groupBy / count — never a per-row loop —
//   and independent queries run together, so a full statistics payload is a
//   handful of round trips with no N+1.
//
// BUSINESS RULES honoured here
//   • Ratings come ONLY from APPROVED reviews (RatingSummary already enforces this;
//     skill ratings apply the same filter).
//   • Cancelled / no-show bookings never count toward completion or revenue.
//   • Reviews are authored by customers about a worker, so "a worker cannot rate
//     themselves" holds by construction — nothing here lets a worker write a rating.
// ============================================================================

import { AppointmentStatus, type Prisma } from "@prisma/client";

/* ─── Professional summary ─────────────────────────────────────────────────── */

export type ProfessionalSummary = {
  id: string;
  name: string;
  title: string | null;
  department: string | null;
  bio: string | null;
  profilePhoto: string | null;
  experienceYears: number;
  joinDate: Date;
  languages: string[];
  certificates: string[];
  // "Specializations" has no column of its own — a worker's specializations ARE
  // their skills, so they are surfaced from WorkerSkill rather than invented.
  specializations: { name: string; proficiency: number }[];
  averageRating: number;
  totalReviews: number;
};

const SUMMARY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  displayName: true,
  bio: true,
  profilePhoto: true,
  experience: true,
  joinDate: true,
  languages: true,
  certificates: true,
  designation: { select: { name: true } },
  department: { select: { name: true } },
  skills: {
    select: { proficiency: true, skill: { select: { name: true } } },
    orderBy: { proficiency: "desc" as const },
  },
  ratingSummary: { select: { averageRating: true, totalReviews: true } },
} satisfies Prisma.WorkerProfileSelect;

/** The worker's professional summary, or null when the profile does not exist. */
export async function getProfessionalSummary(
  workerId: string
): Promise<ProfessionalSummary | null> {
  const w = await prisma.workerProfile.findUnique({
    where: { id: workerId },
    select: SUMMARY_SELECT,
  });
  if (!w) return null;

  return {
    id: w.id,
    name: w.displayName?.trim() || `${w.firstName} ${w.lastName}`.trim(),
    title: w.designation?.name ?? null,
    department: w.department?.name ?? null,
    bio: w.bio,
    profilePhoto: w.profilePhoto,
    experienceYears: w.experience,
    joinDate: w.joinDate,
    languages: w.languages,
    certificates: w.certificates,
    specializations: w.skills.map((s) => ({ name: s.skill.name, proficiency: s.proficiency })),
    averageRating: w.ratingSummary?.averageRating ?? 0,
    totalReviews: w.ratingSummary?.totalReviews ?? 0,
  };
}

/* ─── Skill ratings (per service, calculated) ──────────────────────────────── */

export type SkillRating = {
  serviceId: string;
  serviceName: string;
  averageRating: number;
  reviewCount: number;
};

/**
 * A worker's rating for each service they offer, averaged from APPROVED reviews.
 *
 * Built from the union of the worker's active services and every service they
 * have actually been reviewed on, so a newly-offered service shows 0/0 (honest
 * "no ratings yet") and a service they no longer list but were reviewed on is not
 * silently dropped. Three bounded queries, merged in memory — no per-service N+1.
 */
export async function getSkillRatings(workerId: string): Promise<SkillRating[]> {
  const [offered, grouped] = await Promise.all([
    prisma.workerService.findMany({
      where: { workerId, isActive: true },
      select: { serviceId: true },
    }),
    prisma.review.groupBy({
      by: ["serviceId"],
      where: { workerId, status: "APPROVED", serviceId: { not: null } },
      _avg: { overallRating: true },
      _count: { _all: true },
    }),
  ]);

  const stats = new Map<string, { avg: number; count: number }>();
  for (const g of grouped) {
    if (!g.serviceId) continue;
    stats.set(g.serviceId, {
      avg: g._avg.overallRating ?? 0,
      count: g._count._all,
    });
  }

  // Every serviceId we must name: offered ∪ reviewed.
  const ids = new Set<string>([...offered.map((o) => o.serviceId), ...stats.keys()]);
  if (ids.size === 0) return [];

  const services = await prisma.service.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, name: true },
  });

  return services
    .map((s) => {
      const st = stats.get(s.id);
      return {
        serviceId: s.id,
        serviceName: s.name,
        averageRating: st ? Number(st.avg.toFixed(2)) : 0,
        reviewCount: st?.count ?? 0,
      };
    })
    .sort((a, b) => b.averageRating - a.averageRating || a.serviceName.localeCompare(b.serviceName));
}

/* ─── Professional statistics (calculated) ─────────────────────────────────── */

export type ProfessionalStatistics = {
  completedBookings: number;
  completedServices: number;
  repeatCustomers: number;
  serviceOfferings: number;
  averageRating: number;
  totalReviews: number;
  revenueGenerated: number;
  completionRate: number; // % of resolved bookings that completed
  cancellationRate: number; // % of resolved bookings cancelled or no-show
  growthPercentage: number; // completed bookings, last 30d vs the 30d before
};

/** UTC day, `days` before `from`. Keeps date maths off the local timezone. */
function utcDaysAgo(from: Date, days: number): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

/**
 * Everything the statistics cards need, in one batch of independent aggregates.
 *
 * Completion / cancellation are measured against RESOLVED bookings (completed +
 * cancelled + no-show) — the terminal outcomes — so a pile of future confirmed
 * appointments cannot flatter or dent the percentages. Revenue and completion
 * counts read only COMPLETED rows, so cancelled work never inflates them.
 */
export async function getStatistics(
  workerId: string,
  now: Date = new Date()
): Promise<ProfessionalStatistics> {
  const last30 = utcDaysAgo(now, 30);
  const prev30 = utcDaysAgo(now, 60);

  const [
    byStatus,
    revenue,
    completedServices,
    serviceOfferings,
    summary,
    repeatGroups,
    currentPeriod,
    previousPeriod,
  ] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["status"],
      where: { workerId },
      _count: { _all: true },
    }),
    prisma.appointment.aggregate({
      where: { workerId, status: AppointmentStatus.COMPLETED },
      _sum: { totalAmount: true },
    }),
    prisma.appointmentService.count({
      where: { workerId, status: AppointmentStatus.COMPLETED },
    }),
    prisma.workerService.count({ where: { workerId, isActive: true } }),
    prisma.ratingSummary.findUnique({
      where: { workerId },
      select: { averageRating: true, totalReviews: true },
    }),
    // One group per customer who ever completed a booking with this worker; a
    // repeat customer is a group with more than one.
    prisma.appointment.groupBy({
      by: ["customerId"],
      where: { workerId, status: AppointmentStatus.COMPLETED },
      _count: { _all: true },
    }),
    prisma.appointment.count({
      where: { workerId, status: AppointmentStatus.COMPLETED, appointmentDate: { gte: last30 } },
    }),
    prisma.appointment.count({
      where: {
        workerId,
        status: AppointmentStatus.COMPLETED,
        appointmentDate: { gte: prev30, lt: last30 },
      },
    }),
  ]);

  const counts = new Map<AppointmentStatus, number>();
  for (const row of byStatus) counts.set(row.status, row._count._all);

  const completed = counts.get(AppointmentStatus.COMPLETED) ?? 0;
  const cancelled = counts.get(AppointmentStatus.CANCELLED) ?? 0;
  const noShow = counts.get(AppointmentStatus.NO_SHOW) ?? 0;
  const resolved = completed + cancelled + noShow;

  const repeatCustomers = repeatGroups.filter((g) => g._count._all > 1).length;

  const pct = (num: number, den: number) => (den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0);

  // Growth: if there is no prior-period baseline, any current activity reads as
  // 100% (new momentum), and a flat zero-to-zero reads as 0 — never a divide error.
  const growthPercentage =
    previousPeriod > 0
      ? Number((((currentPeriod - previousPeriod) / previousPeriod) * 100).toFixed(1))
      : currentPeriod > 0
        ? 100
        : 0;

  return {
    completedBookings: completed,
    completedServices,
    repeatCustomers,
    serviceOfferings,
    averageRating: summary?.averageRating ?? 0,
    totalReviews: summary?.totalReviews ?? 0,
    revenueGenerated: revenue._sum.totalAmount ?? 0,
    completionRate: pct(completed, resolved),
    cancellationRate: pct(cancelled + noShow, resolved),
    growthPercentage,
  };
}
