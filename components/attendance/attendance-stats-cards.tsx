// ============================================================================
// MODULE : Attendance — dashboard cards
//
// The headline board for one date. Every number comes from
// GET /api/v1/admin/attendance/summary, which derives them with the same
// summarizeAttendance() the reports and exports use — so these cards cannot drift
// from the table underneath them.
//
// "Not marked" is shown alongside "Absent" on purpose. They are different facts:
// absent means someone was recorded as not turning up; not-marked means nobody has
// said anything about them yet. Collapsing the two would let a branch that has
// marked nobody look like a branch where everybody is present.
// ============================================================================

import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  Hourglass,
  LogIn,
  LogOut,
  Percent,
  Plane,
  Timer,
  TriangleAlert,
  UserMinus,
  Users,
} from "lucide-react";
import { StatCard } from "@/components/shared/ui";
import { formatMinutes, type AttendanceSummary } from "@/components/attendance/types";

export function AttendanceStatsCards({ summary }: { summary: AttendanceSummary }) {
  const cards = [
    {
      label: "Marked today",
      value: `${summary.total} / ${summary.activeWorkers}`,
      hint: summary.notMarked > 0 ? `${summary.notMarked} not marked` : "everyone accounted for",
      icon: CalendarCheck,
    },
    { label: "Present", value: String(summary.present), icon: CheckCircle2 },
    { label: "Late", value: String(summary.late), hint: summary.lateMinutes > 0 ? `${summary.lateMinutes} min total` : undefined, icon: TriangleAlert },
    { label: "Half day", value: String(summary.halfDay), icon: Hourglass },
    { label: "Absent", value: String(summary.absent), icon: UserMinus },
    { label: "On leave", value: String(summary.onLeave), icon: Plane },
    { label: "Currently working", value: String(summary.working), hint: "clocked in, not out", icon: Users },
    { label: "Checked in", value: String(summary.checkedIn + summary.checkedOut), icon: LogIn },
    { label: "Checked out", value: String(summary.checkedOut), icon: LogOut },
    { label: "Total hours today", value: formatMinutes(summary.workingMinutes), icon: Clock },
    { label: "Avg working hours", value: formatMinutes(summary.avgWorkingMinutes), hint: "per marked day", icon: Timer },
    {
      label: "Avg late minutes",
      value: `${summary.avgLateMinutes} min`,
      hint: summary.attendancePct !== null ? `${summary.attendancePct}% attendance` : undefined,
      icon: Percent,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {cards.map((card) => (
        <StatCard
          key={card.label}
          label={card.label}
          value={card.value}
          hint={card.hint}
          icon={card.icon}
        />
      ))}
    </div>
  );
}
