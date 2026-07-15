// ============================================================================
// OWNER  : Hemant | MODULE: Worker — Profile
//
// The operational snapshots — attendance and leave — plus quick actions. Both
// snapshots are computed from REAL rows (Attendance, Leave) by the page and passed
// in; if a worker has no attendance records this month the attendance section is
// not rendered at all (the page decides), never faked. Quick actions are plain
// navigation to pages that already exist; unavailable actions (edit, download ID)
// are simply not present, because there is no backend for them.
// ============================================================================

import * as React from "react";
import Link from "next/link";
import { Badge, StatCard } from "@/components/shared/ui";
import { ProfileSection } from "./profile-ui";
import {
  CalendarCheck,
  Clock,
  Percent,
  AlarmClock,
  CalendarPlus,
  History,
  CalendarClock,
  Images,
} from "lucide-react";

/* ─── Attendance snapshot ────────────────────────────────────────────────── */
export type AttendanceData = {
  todayStatus: string; // enum value or "Not marked"
  attendancePct: number;
  workingHours: number;
  lateCount: number;
};

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PRESENT: "success",
  LATE: "warning",
  ABSENT: "danger",
  HALF_DAY: "info",
  ON_LEAVE: "neutral",
};

export function AttendanceSnapshot({ data }: { data: AttendanceData }) {
  return (
    <ProfileSection
      title="Attendance snapshot"
      icon={CalendarCheck}
      action={<span className="text-[11px] text-gray-400">This month</span>}
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs text-gray-500">Today</span>
        <Badge tone={STATUS_TONE[data.todayStatus] ?? "neutral"}>
          {data.todayStatus === "Not marked" ? "Not marked" : data.todayStatus.replace(/_/g, " ")}
        </Badge>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Attendance" value={`${data.attendancePct}%`} icon={Percent} />
        <StatCard label="Working hours" value={`${data.workingHours} h`} icon={Clock} />
        <StatCard label="Late days" value={String(data.lateCount)} icon={AlarmClock} />
      </div>
    </ProfileSection>
  );
}

/* ─── Leave summary ──────────────────────────────────────────────────────── */
export type LeaveSummaryData = {
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
};

export function LeaveSummary({ data }: { data: LeaveSummaryData }) {
  const cards: { label: string; value: number; tone: string }[] = [
    { label: "Pending", value: data.pending, tone: "text-yellow-700" },
    { label: "Approved", value: data.approved, tone: "text-green-700" },
    { label: "Rejected", value: data.rejected, tone: "text-red-600" },
    { label: "Cancelled", value: data.cancelled, tone: "text-gray-500" },
  ];

  return (
    <ProfileSection
      title="Leave summary"
      icon={CalendarClock}
      action={
        <Link
          href="/worker/leaves"
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 transition hover:text-gray-900 focus:outline-none focus:underline"
        >
          <History className="size-3.5" aria-hidden="true" />
          View history
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-gray-100 bg-gray-50/40 p-3 text-center">
            <p className={`text-2xl font-semibold ${c.tone}`}>{c.value}</p>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
              {c.label}
            </p>
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}

/* ─── Quick actions ──────────────────────────────────────────────────────────
 * Navigation only, to pages that already exist. Edit Profile and Download ID are
 * intentionally absent — no backend supports them, and a button that goes nowhere
 * is worse than no button.
 */
const ACTIONS = [
  { label: "Apply leave", href: "/worker/leaves", icon: CalendarPlus },
  { label: "Leave history", href: "/worker/leaves", icon: History },
  { label: "Attendance", href: "/worker/attendance", icon: CalendarCheck },
  { label: "View portfolio", href: "/worker/portfolio", icon: Images },
] as const;

export function QuickActions() {
  return (
    <ProfileSection title="Quick actions" bodyClassName="p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIONS.map((a) => (
          <Link
            key={a.label}
            href={a.href}
            className="flex flex-col items-center gap-2 rounded-xl border border-gray-100 bg-white p-4 text-center transition hover:border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <a.icon className="size-5 text-gray-500" aria-hidden="true" />
            <span className="text-xs font-medium text-gray-700">{a.label}</span>
          </Link>
        ))}
      </div>
    </ProfileSection>
  );
}
