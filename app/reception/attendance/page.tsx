import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import prisma from "@/lib/db";
import { apiGet, type Paginated } from "@/lib/api-server";
import { API } from "@/lib/endpoints";
import { PageHeader, StatCard } from "@/components/shared/ui";
import { AttendanceError, friendlyError } from "@/components/attendance/attendance-ui";
import { ReceptionClockBoard } from "@/components/attendance/reception-clock-board";
import {
  EMPTY_SUMMARY,
  formatDate,
  formatMinutes,
  todayKey,
  type AttendanceRow,
  type AttendanceSummary,
} from "@/components/attendance/types";
import { CheckCircle2, Clock, LogOut, TriangleAlert, UserMinus, Users } from "lucide-react";

// MODULE: Reception Attendance — today's staff board
//
// WHAT RECEPTION CAN DO HERE: clock employees in and out, start and end their
// breaks. Nothing else — no editing, no deleting, no other branch, no payroll.
// Those are refused by capabilitiesFor() on the server, not merely absent here.
//
// WHY THE WORKER LIST IS READ WITH PRISMA: the workers API admits SUPER_ADMIN,
// OWNER and BRANCH_ADMIN only, so a receptionist cannot call it. Reading it here,
// scoped to the branch on their own session, is the pattern the sibling
// reception/checkin page already uses — and it produces exactly the scoping
// requireBranchScope() would apply. The ATTENDANCE data still comes over the API,
// so every read and write of a record goes through the real RBAC.

const RECEPTION_ROLES = ["RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"] as const;

export default async function ReceptionAttendancePage() {
  const authUser = await getServerUser();
  if (!authUser || !RECEPTION_ROLES.includes(authUser.userType as (typeof RECEPTION_ROLES)[number])) {
    redirect("/login");
  }
  if (!authUser.branchId) redirect("/login");

  const branchId = authUser.branchId;
  const today = todayKey();

  const [workers, listResult, summaryResult] = await Promise.all([
    prisma.workerProfile
      .findMany({
        where: { isActive: true, branches: { some: { branchId, isActive: true } } },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          employeeCode: true,
          designation: { select: { name: true } },
        },
      })
      .catch(() => []),

    apiGet<Paginated<AttendanceRow>>(`${API.reception.attendance}?date=${today}&limit=100`),
    apiGet<AttendanceSummary>(`${API.admin.attendanceSummary}?date=${today}`),
  ]);

  const summary: AttendanceSummary = summaryResult.ok ? summaryResult.data : EMPTY_SUMMARY;

  const records: Record<string, AttendanceRow> = {};
  if (listResult.ok) {
    for (const row of listResult.data.items) records[row.worker.id] = row;
  }

  const boardWorkers = workers.map((w) => ({
    id: w.id,
    name: w.displayName?.trim() || `${w.firstName} ${w.lastName}`.trim(),
    employeeCode: w.employeeCode,
    designation: w.designation?.name ?? null,
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Reception"
        title="Staff attendance"
        subtitle="Clock employees in and out for today. Working hours and late minutes are calculated automatically."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="On duty" value={String(summary.working)} hint="clocked in now" icon={Users} />
        <StatCard label="Present" value={String(summary.present)} icon={CheckCircle2} />
        <StatCard label="Late" value={String(summary.late)} icon={TriangleAlert} />
        <StatCard label="Checked out" value={String(summary.checkedOut)} icon={LogOut} />
        <StatCard label="Not marked" value={String(summary.notMarked)} hint={`of ${summary.activeWorkers} staff`} icon={UserMinus} />
        <StatCard label="Hours today" value={formatMinutes(summary.workingMinutes)} icon={Clock} />
      </div>

      {!listResult.ok ? (
        <AttendanceError message={friendlyError(listResult.status, listResult.message)} />
      ) : (
        <ReceptionClockBoard
          workers={boardWorkers}
          records={records}
          endpoint={API.reception.attendance}
          date={formatDate(today)}
        />
      )}
    </div>
  );
}
