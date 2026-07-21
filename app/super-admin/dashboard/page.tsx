import prisma from "@/lib/db";
import {
  Building2, Users, CalendarDays, Activity, PieChart as PieIcon,
  BarChart3, TrendingUp, ShieldCheck, Server, Clock, Store, UserPlus,
  Scissors, CalendarPlus, ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Panel, PanelHeader, ChartCard, ViewAllLink } from "@/components/dashboard/card";
import { AreaTrendChart, BarCompareChart, StatusDonutChart, type DonutSlice } from "@/components/dashboard/charts-lazy";
import { BranchTable, type BranchRow } from "@/components/dashboard/branch-table";
import { RecentActivity, type ActivityItem } from "@/components/dashboard/recent-activity";
import { FadeIn, Stagger, StaggerItem } from "@/components/dashboard/motion";
import { statusTone } from "@/components/dashboard/status-badge";
import type { NotificationItem } from "@/components/dashboard/notifications";
import { THEME_ROOT_ID } from "@/components/dashboard/use-dash-theme";
import { DashThemeInit } from "@/components/dashboard/dash-theme-init";

// OWNER: Hemant | MODULE: Super Admin Dashboard
// UI-only redesign. All queries below are READ-ONLY (counts / aggregates) — no
// APIs, mutations, or business logic added.

/* ── small server-side helpers (no client hydration risk) ─────────────────── */
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const pct = (curr: number, prev: number) =>
  prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);
const fullName = (f: string, l?: string | null) => `${f}${l ? ` ${l}` : ""}`.trim();

function relTime(from: Date, now: Date) {
  const s = Math.max(1, Math.floor((now.getTime() - from.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
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

export default async function SuperAdminDashboardPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const d14 = new Date(today);
  d14.setDate(d14.getDate() - 13); // 14-day inclusive window
  const d30 = new Date(today);
  d30.setDate(d30.getDate() - 30);
  const d60 = new Date(today);
  d60.setDate(d60.getDate() - 60);

  const [
    // ── existing queries (unchanged) ──────────────────────────────────────
    branchCount, workerCount, customerCount, todayCount, branches,
    // ── additive read-only reads for charts / deltas / feed ───────────────
    windowAppointments, statusGroups, recentAppointments, staff,
    custNew, custPrev, workerNew, workerPrev, branchNew, branchPrev,
  ] = await Promise.all([
    prisma.branch.count({ where: { isActive: true } }),
    prisma.workerProfile.count({ where: { isActive: true } }),
    prisma.customer.count(),
    prisma.appointment.count({ where: { appointmentDate: { gte: today, lt: tomorrow } } }),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, name: true, city: true, code: true, isActive: true,
        _count: {
          select: {
            workerBranches: { where: { isActive: true } },
            appointments: { where: { appointmentDate: { gte: today, lt: tomorrow } } },
          },
        },
      },
    }),
    prisma.appointment.findMany({
      where: { appointmentDate: { gte: d14, lt: tomorrow } },
      select: { appointmentDate: true },
    }),
    prisma.appointment.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: { appointmentDate: { gte: d30, lt: tomorrow } },
    }),
    prisma.appointment.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true, appointmentNo: true, status: true, createdAt: true,
        customer: { select: { firstName: true, lastName: true } },
        branch: { select: { name: true } },
      },
    }),
    prisma.staffProfile.findFirst({
      where: { userId: authUser.userId },
      select: { firstName: true, lastName: true },
    }),
    prisma.customer.count({ where: { createdAt: { gte: d30 } } }),
    prisma.customer.count({ where: { createdAt: { gte: d60, lt: d30 } } }),
    prisma.workerProfile.count({ where: { isActive: true, createdAt: { gte: d30 } } }),
    prisma.workerProfile.count({ where: { isActive: true, createdAt: { gte: d60, lt: d30 } } }),
    prisma.branch.count({ where: { isActive: true, createdAt: { gte: d30 } } }),
    prisma.branch.count({ where: { isActive: true, createdAt: { gte: d60, lt: d30 } } }),
  ]);

  /* ── derive presentational data (all from real reads above) ─────────────── */
  const userName = staff ? fullName(staff.firstName, staff.lastName) : "Admin";
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = today.toLocaleDateString("en-IN", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  // 14-day appointment series (area chart + today's-KPI sparkline)
  const axis = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (13 - i));
    return { key: dayKey(d), label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) };
  });
  const counts: Record<string, number> = {};
  for (const a of windowAppointments) counts[dayKey(a.appointmentDate)] = (counts[dayKey(a.appointmentDate)] ?? 0) + 1;
  const trend = axis.map((a) => ({ label: a.label, value: counts[a.key] ?? 0 }));
  const trendValues = trend.map((t) => t.value);
  const apptToday = trendValues[13] ?? 0;
  const apptYesterday = trendValues[12] ?? 0;

  // status donut
  const statusCount: Record<string, number> = {};
  for (const g of statusGroups) statusCount[g.status] = g._count._all;
  const donut: DonutSlice[] = STATUS_ORDER.filter((s) => statusCount[s]).map((s) => ({
    label: STATUS_META[s].label, value: statusCount[s], color: STATUS_META[s].color,
  }));

  // branch comparison (workers per branch — real, from existing query)
  const branchBars = [...branches]
    .sort((a, b) => b._count.workerBranches - a._count.workerBranches)
    .slice(0, 6)
    .map((b) => ({ label: b.name.length > 16 ? b.name.slice(0, 15) + "…" : b.name, value: b._count.workerBranches }));

  // branch table rows
  const branchRows: BranchRow[] = branches.map((b) => ({
    id: b.id, name: b.name, city: b.city, code: b.code,
    workers: b._count.workerBranches, today: b._count.appointments, isActive: b.isActive,
    href: `/super-admin/branches/${b.id}`,
  }));

  // recent activity + notifications (derived from recent appointments)
  const activity: ActivityItem[] = recentAppointments.map((a) => ({
    id: a.id,
    title: (
      <span>
        <span className="font-medium text-gray-900 dark:text-(--sa-text)">{fullName(a.customer.firstName, a.customer.lastName)}</span> booked an appointment
      </span>
    ),
    meta: `${a.branch.name} · ${a.appointmentNo}`,
    time: relTime(a.createdAt, now),
    tone: statusTone(a.status),
    icon: CalendarDays,
    href: `/super-admin/branches`,
  }));

  const notifications: NotificationItem[] = recentAppointments.slice(0, 5).map((a) => ({
    id: a.id,
    title: `New booking · ${a.appointmentNo}`,
    meta: `${fullName(a.customer.firstName, a.customer.lastName)} at ${a.branch.name}`,
    tone: statusTone(a.status),
    unread: a.status === "PENDING" || a.status === "CONFIRMED",
    href: "/super-admin/branches",
  }));

  const health = [
    { label: "Active branches", value: branchCount, icon: Building2, tone: "text-emerald-500" },
    { label: "Active workers", value: workerCount, icon: Users, tone: "text-emerald-500" },
    { label: "Today's load", value: todayCount, icon: CalendarDays, tone: "text-amber-500" },
  ];

  const quickLinks = [
    { label: "New branch", href: "/super-admin/branches/new", icon: Store },
    { label: "Add worker", href: "/super-admin/workers", icon: UserPlus },
    { label: "New service", href: "/super-admin/services", icon: Scissors },
    { label: "New booking", href: "/super-admin/customers", icon: CalendarPlus },
  ];

  return (
    // Full-bleed premium canvas (bg only — the shared shell is untouched).
    // `sa-dash` scopes the theme tokens; the inline script applies the stored
    // theme before first paint (no flash). Dark background comes from the CSS
    // token on `.sa-dash.dark`; light stays `bg-slate-50`.
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
            role="super-admin"
            userName={userName}
            greeting={greeting}
            dateLabel={dateLabel}
            notifications={notifications}
            hideControls
          />
        </FadeIn>

        {/* ── Statistics ─────────────────────────────────────────────────── */}
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StaggerItem>
            <StatCard label="Active Branches" value={branchCount} icon="branches" accent="violet"
              delta={pct(branchNew, branchPrev)} hint={`${branchNew} added in 30 days`} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Active Workers" value={workerCount} icon="workers" accent="sky"
              delta={pct(workerNew, workerPrev)} hint={`${workerNew} onboarded in 30 days`} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Total Customers" value={customerCount} icon="customers" accent="emerald"
              delta={pct(custNew, custPrev)} hint={`${custNew} new in 30 days`} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Today's Appointments" value={todayCount} icon="appointments" accent="amber"
              delta={pct(apptToday, apptYesterday)} hint="vs. yesterday" spark={trendValues} />
          </StaggerItem>
        </Stagger>

        {/* ── Main grid: analytics + table (left) · side panel (right) ────── */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* LEFT */}
          <div className="space-y-6 xl:col-span-2">
            {/* Analytics — appointment trend */}
            <FadeIn>
              <ChartCard
                title="Appointment trends"
                subtitle="Bookings over the last 14 days"
                icon={Activity}
                action={<ViewAllLink href="/super-admin/reports">Reports</ViewAllLink>}
              >
                <AreaTrendChart data={trend} />
              </ChartCard>
            </FadeIn>

            {/* Analytics — status split + branch performance */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <FadeIn>
                <ChartCard title="Appointment status" subtitle="Last 30 days" icon={PieIcon}>
                  <StatusDonutChart data={donut} />
                </ChartCard>
              </FadeIn>
              <FadeIn>
                <ChartCard title="Team by branch" subtitle="Active workers per branch" icon={BarChart3}>
                  {branchBars.length ? (
                    <BarCompareChart data={branchBars} />
                  ) : (
                    <p className="py-16 text-center text-sm text-gray-400 dark:text-(--sa-muted)">No branch data yet.</p>
                  )}
                </ChartCard>
              </FadeIn>
            </div>

            {/* Branch overview table */}
            <FadeIn>
              <Panel>
                <PanelHeader
                  title="Branch overview"
                  subtitle={`${branchCount} active ${branchCount === 1 ? "branch" : "branches"}`}
                  icon={Building2}
                  action={<ViewAllLink href="/super-admin/branches" />}
                />
                <BranchTable rows={branchRows} />
              </Panel>
            </FadeIn>
          </div>

          {/* RIGHT — side panel */}
          <div className="space-y-6">
            {/* Recent activity */}
            <FadeIn>
              <Panel>
                <PanelHeader title="Recent activity" icon={TrendingUp} action={<ViewAllLink href="/super-admin/audit-logs">Logs</ViewAllLink>} />
                {activity.length ? (
                  <RecentActivity items={activity} />
                ) : (
                  <p className="px-5 py-10 text-center text-sm text-gray-400 dark:text-(--sa-muted)">No recent activity.</p>
                )}
              </Panel>
            </FadeIn>

            {/* System health */}
            <FadeIn>
              <Panel>
                <PanelHeader title="System health" icon={ShieldCheck} />
                <div className="space-y-1 p-3">
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50/60 px-3 py-2.5 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20">
                    <span className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      <Server className="size-4" /> All systems operational
                    </span>
                    <span className="relative flex size-2 items-center justify-center">
                      <span className="absolute inline-flex size-2 animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative size-2 rounded-full bg-emerald-500" />
                    </span>
                  </div>
                  {health.map((h) => (
                    <div key={h.label} className="flex items-center justify-between px-3 py-2">
                      <span className="flex items-center gap-2.5 text-sm text-gray-600 dark:text-(--sa-text-2)">
                        <h.icon className={`size-4 ${h.tone}`} /> {h.label}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-(--sa-text)">{h.value}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </FadeIn>

            {/* Quick actions */}
            <FadeIn>
              <Panel>
                <PanelHeader title="Quick actions" icon={Clock} />
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
