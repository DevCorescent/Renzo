import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { ProfileHero } from "@/components/worker-profile/profile-hero";
import {
  PersonalDetails,
  EmploymentDetails,
  ProfessionalSkills,
  AssignedServices,
  CurrentBranch,
  Documents,
} from "@/components/worker-profile/profile-sections";
import {
  AttendanceSnapshot,
  LeaveSummary,
  QuickActions,
} from "@/components/worker-profile/profile-snapshots";

// OWNER: Hemant | MODULE: Worker — Profile
//
// The internal profile — an identity/employment record, NOT the portfolio. The UI
// was rebuilt into premium, sectioned cards, but the data contract is unchanged:
// still a Server Component reading the worker's own record directly.
//
// Everything is READ ONLY: there is no worker self-edit API, so no field is
// editable and no edit/download action is offered. Sections without backing data
// hide themselves — attendance is omitted when no records exist this month; skills,
// services and documents hide when empty; emergency contact and notifications are
// absent entirely because no schema field exists for them. Nothing is faked, and
// no value ever renders as null/undefined.

export default async function WorkerProfilePage() {
  const authUser = await getServerUser();
  if (!authUser?.workerId) redirect("/login");
  const workerId = authUser.workerId;

  // Current-month window for the attendance snapshot, pinned to UTC like every
  // other date in the codebase.
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const todayIso = now.toISOString().slice(0, 10);

  // One parallel batch — no waterfalls, no duplicate queries. Attendance and leave
  // are new reads (not duplicates of the worker query): the data already exists in
  // the schema, so these sections are backed, not faked.
  const [worker, leaveGroups, attendanceRows] = await Promise.all([
    prisma.workerProfile.findUnique({
      where: { id: workerId },
      include: {
        designation: { select: { name: true, level: true } },
        department: { select: { name: true } },
        skills: { include: { skill: { select: { name: true } } } },
        services: {
          where: { isActive: true },
          include: { service: { select: { name: true, duration: true } } },
        },
        branches: { include: { branch: { select: { name: true, city: true } } } },
      },
    }),
    prisma.leave.groupBy({ by: ["status"], where: { workerId }, _count: { _all: true } }),
    prisma.attendance.findMany({
      where: { workerId, date: { gte: monthStart } },
      select: { date: true, status: true, lateMinutes: true, workingMinutes: true },
    }),
  ]);

  if (!worker) redirect("/login");

  // ── Current / primary branch ────────────────────────────────────────────
  const primaryLink =
    worker.branches.find((b) => b.isPrimary && b.isActive) ??
    worker.branches.find((b) => b.isActive) ??
    worker.branches[0] ??
    null;

  // ── Leave summary ─────────────────────────────────────────────────────────
  const leave = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  for (const g of leaveGroups) {
    const n = g._count._all;
    if (g.status === "PENDING") leave.pending = n;
    else if (g.status === "APPROVED") leave.approved = n;
    else if (g.status === "REJECTED") leave.rejected = n;
    else if (g.status === "CANCELLED") leave.cancelled = n;
  }

  // ── Attendance snapshot (this month) ──────────────────────────────────────
  // Null when there is nothing to show, so the page can hide the section entirely
  // rather than render zeros as if they were real attendance.
  let attendance: {
    todayStatus: string;
    attendancePct: number;
    workingHours: number;
    lateCount: number;
  } | null = null;

  if (attendanceRows.length > 0) {
    let attended = 0;
    let lateCount = 0;
    let workingMinutes = 0;
    let todayStatus = "Not marked";

    for (const r of attendanceRows) {
      if (r.status === "PRESENT" || r.status === "LATE") attended += 1;
      else if (r.status === "HALF_DAY") attended += 0.5;
      if (r.status === "LATE" || r.lateMinutes > 0) lateCount += 1;
      workingMinutes += r.workingMinutes;
      if (r.date.toISOString().slice(0, 10) === todayIso) todayStatus = r.status;
    }

    attendance = {
      todayStatus,
      attendancePct: Math.round((attended / attendanceRows.length) * 100),
      workingHours: Math.round((workingMinutes / 60) * 10) / 10,
      lateCount,
    };
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <ProfileHero
        data={{
          id: worker.id,
          firstName: worker.firstName,
          lastName: worker.lastName,
          photo: worker.profilePhoto,
          designation: worker.designation?.name ?? null,
          department: worker.department?.name ?? null,
          employeeCode: worker.employeeCode,
          branchName: primaryLink?.branch.name ?? null,
          experience: worker.experience,
          isActive: worker.isActive,
          joinDate: worker.joinDate,
        }}
      />

      <PersonalDetails
        data={{
          phone: worker.phone,
          email: worker.email,
          gender: worker.gender,
          dateOfBirth: worker.dateOfBirth,
          languages: worker.languages,
          bio: worker.bio,
        }}
      />

      <EmploymentDetails
        data={{
          employeeCode: worker.employeeCode,
          department: worker.department?.name ?? null,
          designation: worker.designation?.name ?? null,
          experience: worker.experience,
          joinDate: worker.joinDate,
          currentBranch: primaryLink?.branch.name ?? null,
          primaryBranch:
            worker.branches.find((b) => b.isPrimary)?.branch.name ?? primaryLink?.branch.name ?? null,
          isActive: worker.isActive,
        }}
      />

      <ProfessionalSkills
        skills={worker.skills.map((s) => ({ name: s.skill.name, proficiency: s.proficiency }))}
      />

      <AssignedServices
        services={worker.services.map((ws) => ({
          name: ws.service.name,
          duration: ws.service.duration,
          isActive: ws.isActive,
        }))}
      />

      <CurrentBranch
        branches={worker.branches.map((wb) => ({
          name: wb.branch.name,
          city: wb.branch.city,
          isPrimary: wb.isPrimary,
          isActive: wb.isActive,
        }))}
      />

      {attendance && <AttendanceSnapshot data={attendance} />}

      <LeaveSummary data={leave} />

      <Documents certificates={worker.certificates} />

      <QuickActions />
    </div>
  );
}
