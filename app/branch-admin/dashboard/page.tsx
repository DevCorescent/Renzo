import prisma from "@/lib/db";
import {
  Users, CalendarDays, Activity, PieChart as PieIcon, BarChart3, TrendingUp,
  ShieldCheck, Server, IndianRupee, CalendarPlus, UserPlus, Scissors, ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Panel, PanelHeader, ChartCard, ViewAllLink } from "@/components/dashboard/card";
import { AreaTrendChart, BarCompareChart, StatusDonutChart, type DonutSlice } from "@/components/dashboard/charts-lazy";
import { ScheduleTable, type ScheduleRow } from "@/components/dashboard/schedule-table";
import { RecentActivity, type ActivityItem } from "@/components/dashboard/recent-activity";
import { FadeIn, Stagger, StaggerItem } from "@/components/dashboard/motion";
import { statusTone } from "@/components/dashboard/status-badge";
import type { NotificationItem } from "@/components/dashboard/notifications";
import { THEME_ROOT_ID } from "@/components/dashboard/use-dash-theme";
import { DashThemeInit } from "@/components/dashboard/dash-theme-init";

// OWNER: Hemant | MODULE: Branch Admin (Owner) Dashboard
// UI-only redesign — reuses the Super Admin design system. All queries below are
// READ-ONLY (counts / aggregates) and branch-scoped. No APIs / mutations / logic.

/* ── server-side helpers (no client hydration risk) ───────────────────────── */
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const pct = (curr: number, prev: number) =>
  prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);
const fullName = (f: string, l?: string | null) => `${f}${l ? ` ${l}` : ""}`.trim();
const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

function relTime(from: Date, now: Date) {
  const s = Math.max(1, Math.floor((now.getTime() - from.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: "Completed", color: "#059669" },
  CONFIRMED: { label: "Confirmed", color: "#10b981" },
  CHECKED_IN: { label: "Checked in", color: "#0ea5e9" },
  STARTED: { label: "In service", color: "#6366f1" },
  PENDING: { label: "Pending", color: "#f59e0b" },
  RESCHEDULED: { label: "Rescheduled", color: "#64748b" },
  NO_SHOW: { label: "No-show", color: "#fb7185" },
  CANCELLED: { label: "Cancelled", color: "#ef4444" },
};
const STATUS_ORDER = Object.keys(STATUS_META);

export default async function BranchAdminDashboardPage() {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/login");
  const branchId = authUser.branchId;

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d14 = new Date(today);
  d14.setDate(d14.getDate() - 13);
  const d30 = new Date(today);
  d30.setDate(d30.getDate() - 30);

  const [
    branch, staff, todayCount, inServiceCount, workerCount, pendingCount, revenueAgg,
    todaysAppointments, windowAppointments, revenueWindow, statusGroups, recentAppointments, serviceRows,
  ] = await Promise.all([
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true, city: true } }),
    prisma.staffProfile.findFirst({ where: { userId: authUser.userId }, select: { firstName: true, lastName: true } }),
    prisma.appointment.count({ where: { branchId, appointmentDate: { gte: today, lt: tomorrow } } }),
    prisma.appointment.count({ where: { branchId, status: "STARTED", appointmentDate: { gte: today, lt: tomorrow } } }),
    prisma.workerBranch.count({ where: { branchId, isActive: true } }),
    prisma.appointment.count({ where: { branchId, status: "PENDING", appointmentDate: { gte: today } } }),
    prisma.invoice.aggregate({ _sum: { paidAmount: true }, where: { branchId, createdAt: { gte: today, lt: tomorrow } } }),
    prisma.appointment.findMany({
      where: { branchId, appointmentDate: { gte: today, lt: tomorrow } },
      orderBy: { startTime: "asc" },
      take: 30,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        worker: { select: { firstName: true, lastName: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    }),
    prisma.appointment.findMany({
      where: { branchId, appointmentDate: { gte: d14, lt: tomorrow } },
      select: { appointmentDate: true },
    }),
    prisma.invoice.findMany({
      where: { branchId, createdAt: { gte: d14, lt: tomorrow } },
      select: { paidAmount: true, createdAt: true },
    }),
    prisma.appointment.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { branchId, appointmentDate: { gte: d30, lt: tomorrow } },
    }),
    prisma.appointment.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true, appointmentNo: true, status: true, createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    }),
    prisma.appointmentService.findMany({
      where: { appointment: { branchId, appointmentDate: { gte: d30, lt: tomorrow } } },
      select: { service: { select: { name: true } } },
    }),
  ]);

  /* ── derive presentational data (all from real reads above) ─────────────── */
  const userName = staff ? fullName(staff.firstName, staff.lastName) : "Admin";
  const revenue = Number(revenueAgg._sum.paidAmount ?? 0);
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = today.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // 14-day series axis
  const axis = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (13 - i));
    return { key: dayKey(d), label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) };
  });

  // appointment trend
  const apptCounts: Record<string, number> = {};
  for (const a of windowAppointments) apptCounts[dayKey(a.appointmentDate)] = (apptCounts[dayKey(a.appointmentDate)] ?? 0) + 1;
  const trend = axis.map((a) => ({ label: a.label, value: apptCounts[a.key] ?? 0 }));
  const trendValues = trend.map((t) => t.value);
  const apptToday = trendValues[13] ?? 0;
  const apptYesterday = trendValues[12] ?? 0;

  // revenue trend
  const revBuckets: Record<string, number> = {};
  for (const inv of revenueWindow) revBuckets[dayKey(inv.createdAt)] = (revBuckets[dayKey(inv.createdAt)] ?? 0) + Number(inv.paidAmount ?? 0);
  const revValues = axis.map((a) => Math.round(revBuckets[a.key] ?? 0));
  const revToday = revValues[13] ?? 0;
  const revYesterday = revValues[12] ?? 0;

  // status donut
  const statusCount: Record<string, number> = {};
  for (const g of statusGroups) statusCount[g.status] = g._count._all;
  const donut: DonutSlice[] = STATUS_ORDER.filter((s) => statusCount[s]).map((s) => ({
    label: STATUS_META[s].label, value: statusCount[s], color: STATUS_META[s].color,
  }));

  // top services (last 30 days)
  const serviceCount: Record<string, number> = {};
  for (const r of serviceRows) {
    const n = r.service?.name ?? "—";
    serviceCount[n] = (serviceCount[n] ?? 0) + 1;
  }
  const topServices = Object.entries(serviceCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ label: name.length > 16 ? name.slice(0, 15) + "…" : name, value }));

  // today's schedule rows
  const scheduleRows: ScheduleRow[] = todaysAppointments.map((a) => ({
    id: a.id,
    time: `${a.startTime} – ${a.endTime}`,
    startMinutes: toMinutes(a.startTime),
    customer: fullName(a.customer.firstName, a.customer.lastName),
    phone: a.customer.phone ?? undefined,
    service: a.services.map((s) => s.service.name).join(", ") || "—",
    worker: a.worker ? fullName(a.worker.firstName, a.worker.lastName) : "Unassigned",
    status: a.status,
    href: `/branch-admin/appointments`,
  }));

  // recent activity + notifications
  const activity: ActivityItem[] = recentAppointments.map((a) => ({
    id: a.id,
    title: (
      <span>
        <span className="font-medium text-gray-900 dark:text-(--sa-text)">{fullName(a.customer.firstName, a.customer.lastName)}</span> booked an appointment
      </span>
    ),
    meta: a.appointmentNo,
    time: relTime(a.createdAt, now),
    tone: statusTone(a.status),
    icon: CalendarDays,
    href: "/branch-admin/appointments",
  }));

  const notifications: NotificationItem[] = recentAppointments.slice(0, 5).map((a) => ({
    id: a.id,
    title: `New booking · ${a.appointmentNo}`,
    meta: fullName(a.customer.firstName, a.customer.lastName),
    tone: statusTone(a.status),
    unread: a.status === "PENDING" || a.status === "CONFIRMED",
    href: "/branch-admin/appointments",
  }));

  const glance = [
    { label: "Appointments today", value: todayCount, icon: CalendarDays, tone: "text-amber-500" },
    { label: "In service now", value: inServiceCount, icon: Activity, tone: "text-sky-500" },
    { label: "Active workers", value: workerCount, icon: Users, tone: "text-emerald-500" },
  ];

  const quickLinks = [
    { label: "New appointment", href: "/branch-admin/appointments", icon: CalendarPlus },
    { label: "Manage workers", href: "/branch-admin/workers", icon: UserPlus },
    { label: "Schedule", href: "/branch-admin/schedule", icon: CalendarDays },
    { label: "Reports", href: "/branch-admin/reports", icon: BarChart3 },
  ];

  return (
    <div
      id={THEME_ROOT_ID}
      suppressHydrationWarning
      className="sa-dash -m-6 min-h-[calc(100vh-3.5rem)] bg-slate-50 p-4 transition-colors duration-300 sm:p-6"
    >
      <DashThemeInit />
      <div className="mx-auto max-w-350 space-y-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <FadeIn>
          <DashboardHeader
            role="branch-admin"
            userName={userName}
            greeting={greeting}
            dateLabel={dateLabel}
            notifications={notifications}
          />
        </FadeIn>

        {/* ── Statistics ─────────────────────────────────────────────────── */}
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StaggerItem>
            <StatCard label="Today's Appointments" value={todayCount} icon="appointments" accent="amber"
              delta={pct(apptToday, apptYesterday)} hint="vs. yesterday" spark={trendValues} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Today's Revenue" value={revenue} icon="revenue" accent="emerald" format="inr"
              delta={pct(revToday, revYesterday)} hint="vs. yesterday" spark={revValues} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Active Workers" value={workerCount} icon="workers" accent="sky"
              hint={branch?.name ? `at ${branch.name}` : "in this branch"} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Pending Bookings" value={pendingCount} icon="pending" accent="violet"
              hint="awaiting confirmation" />
          </StaggerItem>
        </Stagger>

        {/* ── Main grid: analytics + table (left) · side panel (right) ────── */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* LEFT */}
          <div className="space-y-6 xl:col-span-2">
            <FadeIn>
              <ChartCard
                title="Appointment trends"
                subtitle="Bookings over the last 14 days"
                icon={Activity}
                action={<ViewAllLink href="/branch-admin/reports">Reports</ViewAllLink>}
              >
                <AreaTrendChart data={trend} />
              </ChartCard>
            </FadeIn>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <FadeIn>
                <ChartCard title="Appointment status" subtitle="Last 30 days" icon={PieIcon}>
                  <StatusDonutChart data={donut} />
                </ChartCard>
              </FadeIn>
              <FadeIn>
                <ChartCard title="Top services" subtitle="By bookings · last 30 days" icon={BarChart3}>
                  {topServices.length ? (
                    <BarCompareChart data={topServices} />
                  ) : (
                    <p className="py-16 text-center text-sm text-gray-400 dark:text-(--sa-muted)">No service data yet.</p>
                  )}
                </ChartCard>
              </FadeIn>
            </div>

            <FadeIn>
              <Panel>
                <PanelHeader
                  title="Today's schedule"
                  subtitle={`${todayCount} ${todayCount === 1 ? "appointment" : "appointments"} today`}
                  icon={CalendarDays}
                  action={<ViewAllLink href="/branch-admin/appointments" />}
                />
                <ScheduleTable rows={scheduleRows} />
              </Panel>
            </FadeIn>
          </div>

          {/* RIGHT — side panel */}
          <div className="space-y-6">
            <FadeIn>
              <Panel>
                <PanelHeader title="Recent activity" icon={TrendingUp} action={<ViewAllLink href="/branch-admin/appointments">All</ViewAllLink>} />
                {activity.length ? (
                  <RecentActivity items={activity} />
                ) : (
                  <p className="px-5 py-10 text-center text-sm text-gray-400 dark:text-(--sa-muted)">No recent activity.</p>
                )}
              </Panel>
            </FadeIn>

            <FadeIn>
              <Panel>
                <PanelHeader title="Today at a glance" icon={ShieldCheck} />
                <div className="space-y-1 p-3">
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50/60 px-3 py-2.5 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20">
                    <span className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      <Server className="size-4" /> Branch operational
                    </span>
                    <span className="relative flex size-2 items-center justify-center">
                      <span className="absolute inline-flex size-2 animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative size-2 rounded-full bg-emerald-500" />
                    </span>
                  </div>
                  {glance.map((g) => (
                    <div key={g.label} className="flex items-center justify-between px-3 py-2">
                      <span className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-(--sa-text-2)">
                        <g.icon className={`size-4 ${g.tone}`} /> {g.label}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-(--sa-text)">{g.value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-(--sa-text-2)">
                      <IndianRupee className="size-4 text-violet-500" /> Revenue today
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-(--sa-text)">
                      ₹{revenue.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </Panel>
            </FadeIn>

            <FadeIn>
              <Panel>
                <PanelHeader title="Quick actions" icon={Scissors} />
                <div className="grid grid-cols-2 gap-2 p-3">
                  {quickLinks.map((q) => (
                    <Link
                      key={q.href}
                      href={q.href}
                      className="group flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/50 p-3 transition-all hover:border-amber-200 hover:bg-amber-50/50 dark:border-(--sa-border) dark:bg-white/3 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/5"
                    >
                      <span className="flex size-8 items-center justify-center rounded-lg bg-white text-amber-600 ring-1 ring-gray-200/70 transition-colors group-hover:ring-amber-200 dark:bg-white/5 dark:text-amber-400 dark:ring-(--sa-border) dark:group-hover:ring-amber-500/30">
                        <q.icon className="size-4" />
                      </span>
                      <span className="flex items-center justify-between text-sm font-medium text-gray-700 dark:text-(--sa-text-2)">
                        {q.label}
                        <ArrowUpRight className="size-3.5 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-amber-500 dark:text-(--sa-muted) dark:group-hover:text-amber-400" />
                      </span>
                    </Link>
                  ))}
                </div>
              </Panel>
            </FadeIn>
          </div>
        </div>
      </div>
    </div>
  );
}
