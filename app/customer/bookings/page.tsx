import prisma from "@/lib/db";
import {
  CalendarDays, CalendarClock, Activity, PieChart as PieIcon, BarChart3, TrendingUp,
  IndianRupee, UserCheck, Sparkles, Wallet, Crown, User, ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Panel, PanelHeader, ChartCard, ViewAllLink } from "@/components/dashboard/card";
import { AreaTrendChart, BarCompareChart, StatusDonutChart, type DonutSlice } from "@/components/dashboard/charts-lazy";
import { BookingsTable, type BookingRow } from "@/components/dashboard/bookings-table";
import { RecentActivity, type ActivityItem } from "@/components/dashboard/recent-activity";
import { FadeIn, Stagger, StaggerItem } from "@/components/dashboard/motion";
import { statusTone } from "@/components/dashboard/status-badge";
import type { NotificationItem } from "@/components/dashboard/notifications";
import { THEME_ROOT_ID } from "@/components/dashboard/use-dash-theme";

// OWNER: Devanshi | MODULE: Customer Bookings
// UI-only redesign — reuses the shared RENZO design system. All queries below are
// READ-ONLY (counts / aggregates) and customer-scoped. No APIs / mutations / logic.

/* ── server-side helpers (no client hydration risk) ───────────────────────── */
const fullName = (f: string, l?: string | null) => `${f}${l ? ` ${l}` : ""}`.trim();

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

export default async function CustomerBookingsPage() {
  const authUser = await getServerUser();
  if (!authUser?.customerId) redirect("/login");
  const customerId = authUser.customerId;

  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [customer, appointments, totalBookings, upcomingCount, completedCount, spentAgg] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId }, select: { firstName: true, lastName: true } }),
    prisma.appointment.findMany({
      where: { customerId },
      orderBy: [{ appointmentDate: "desc" }, { startTime: "asc" }],
      take: 100,
      include: {
        branch: { select: { name: true, city: true } },
        worker: { select: { firstName: true, lastName: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    }),
    prisma.appointment.count({ where: { customerId } }),
    prisma.appointment.count({ where: { customerId, status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "STARTED", "RESCHEDULED"] }, appointmentDate: { gte: today } } }),
    prisma.appointment.count({ where: { customerId, status: "COMPLETED" } }),
    prisma.appointment.aggregate({ _sum: { paidAmount: true }, where: { customerId } }),
  ]);

  /* ── derive presentational data (all from real reads above) ─────────────── */
  const userName = customer ? fullName(customer.firstName, customer.lastName) : "Guest";
  const totalSpent = Math.round(Number(spentAgg._sum.paidAmount ?? 0));
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = today.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const lastVisit = appointments.length ? new Date(appointments[0].appointmentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

  // visits over the last 6 months (area)
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-IN", { month: "short" }) };
  });
  const monthCounts: Record<string, number> = {};
  for (const a of appointments) {
    const d = new Date(a.appointmentDate);
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    monthCounts[k] = (monthCounts[k] ?? 0) + 1;
  }
  const visitsTrend = months.map((m) => ({ label: m.label, value: monthCounts[m.key] ?? 0 }));

  // status donut
  const statusCount: Record<string, number> = {};
  for (const a of appointments) statusCount[a.status] = (statusCount[a.status] ?? 0) + 1;
  const donut: DonutSlice[] = STATUS_ORDER.filter((s) => statusCount[s]).map((s) => ({
    label: STATUS_META[s].label, value: statusCount[s], color: STATUS_META[s].color,
  }));

  // favourite services
  const serviceCount: Record<string, number> = {};
  for (const a of appointments) for (const s of a.services) {
    const n = s.service?.name ?? "—";
    serviceCount[n] = (serviceCount[n] ?? 0) + 1;
  }
  const topServices = Object.entries(serviceCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ label: name.length > 16 ? name.slice(0, 15) + "…" : name, value }));

  // booking history rows
  const bookingRows: BookingRow[] = appointments.map((a) => ({
    id: a.id,
    date: new Date(a.appointmentDate).toLocaleDateString("en-IN"),
    dateSort: new Date(a.appointmentDate).getTime(),
    time: `${a.startTime} – ${a.endTime}`,
    service: a.services.map((s) => s.service.name).join(", ") || "—",
    branch: a.branch.name,
    city: a.branch.city ?? undefined,
    amount: Math.round(Number(a.totalAmount)),
    status: a.status,
    href: `/customer/bookings/${a.id}`,
  }));

  // recent activity + notifications (most recently created bookings)
  const recent = [...appointments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 6);
  const activity: ActivityItem[] = recent.map((a) => ({
    id: a.id,
    title: (
      <span>
        <span className="font-medium text-gray-900 dark:text-(--sa-text)">{a.services.map((s) => s.service.name).join(", ") || "Appointment"}</span> at {a.branch.name}
      </span>
    ),
    meta: a.appointmentNo,
    time: relTime(a.createdAt, now),
    tone: statusTone(a.status),
    icon: CalendarDays,
    href: `/customer/bookings/${a.id}`,
  }));

  const notifications: NotificationItem[] = recent.slice(0, 5).map((a) => ({
    id: a.id,
    title: `Booking · ${a.appointmentNo}`,
    meta: `${a.branch.name} · ${STATUS_META[a.status]?.label ?? a.status}`,
    tone: statusTone(a.status),
    unread: a.status === "PENDING" || a.status === "CONFIRMED",
    href: `/customer/bookings/${a.id}`,
  }));

  const glance = [
    { label: "Upcoming", value: String(upcomingCount), icon: CalendarClock, tone: "text-violet-500" },
    { label: "Completed visits", value: String(completedCount), icon: UserCheck, tone: "text-emerald-500" },
    { label: "Last visit", value: lastVisit, icon: CalendarDays, tone: "text-sky-500" },
    { label: "Total spent", value: `₹${totalSpent.toLocaleString("en-IN")}`, icon: IndianRupee, tone: "text-amber-500" },
  ];

  const quickLinks = [
    { label: "Wallet", href: "/customer/wallet", icon: Wallet },
    { label: "Membership", href: "/customer/membership", icon: Crown },
    { label: "Loyalty", href: "/customer/loyalty", icon: Sparkles },
    { label: "Profile", href: "/customer/profile", icon: User },
  ];

  return (
    <div
      id={THEME_ROOT_ID}
      suppressHydrationWarning
      className="sa-dash dark -m-6 min-h-[calc(100vh-3.5rem)] p-4 transition-colors duration-300 sm:p-6"
    >
      <div className="mx-auto max-w-350 space-y-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <FadeIn>
          <DashboardHeader
            role="customer"
            userName={userName}
            greeting={greeting}
            dateLabel={dateLabel}
            notifications={notifications}
          />
        </FadeIn>

        {/* ── Statistics ─────────────────────────────────────────────────── */}
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StaggerItem>
            <StatCard label="Upcoming" value={upcomingCount} icon="pending" accent="violet"
              hint="scheduled visits" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Completed Visits" value={completedCount} icon="served" accent="emerald"
              hint="lifetime" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Total Spent" value={totalSpent} icon="revenue" accent="amber" format="inr"
              hint="across all visits" />
          </StaggerItem>
          <StaggerItem>
            <StatCard label="Total Bookings" value={totalBookings} icon="appointments" accent="sky"
              hint="all time" />
          </StaggerItem>
        </Stagger>

        {/* ── Main grid: analytics + history (left) · side panel (right) ──── */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* LEFT */}
          <div className="space-y-6 xl:col-span-2">
            <FadeIn>
              <ChartCard
                title="Your visits"
                subtitle="Appointments over the last 6 months"
                icon={Activity}
                action={<ViewAllLink href="/customer/loyalty">Rewards</ViewAllLink>}
              >
                <AreaTrendChart data={visitsTrend} />
              </ChartCard>
            </FadeIn>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <FadeIn>
                <ChartCard title="Booking status" subtitle="Your history" icon={PieIcon}>
                  <StatusDonutChart data={donut} />
                </ChartCard>
              </FadeIn>
              <FadeIn>
                <ChartCard title="Favourite services" subtitle="Most booked" icon={BarChart3}>
                  {topServices.length ? (
                    <BarCompareChart data={topServices} />
                  ) : (
                    <p className="py-16 text-center text-sm text-gray-400 dark:text-(--sa-muted)">No bookings yet.</p>
                  )}
                </ChartCard>
              </FadeIn>
            </div>

            <FadeIn>
              <Panel>
                <PanelHeader
                  title="Booking history"
                  subtitle={`${totalBookings} ${totalBookings === 1 ? "booking" : "bookings"}`}
                  icon={CalendarDays}
                />
                <BookingsTable rows={bookingRows} />
              </Panel>
            </FadeIn>
          </div>

          {/* RIGHT — side panel */}
          <div className="space-y-6">
            <FadeIn>
              <Panel>
                <PanelHeader title="Recent activity" icon={TrendingUp} action={<ViewAllLink href="/customer/reviews">Reviews</ViewAllLink>} />
                {activity.length ? (
                  <RecentActivity items={activity} />
                ) : (
                  <p className="px-5 py-10 text-center text-sm text-gray-400 dark:text-(--sa-muted)">No recent activity.</p>
                )}
              </Panel>
            </FadeIn>

            <FadeIn>
              <Panel>
                <PanelHeader title="Account summary" icon={Sparkles} />
                <div className="space-y-1 p-3">
                  <div className="flex items-center justify-between rounded-lg bg-emerald-50/60 px-3 py-2.5 ring-1 ring-inset ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/20">
                    <span className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      <Sparkles className="size-4" /> Welcome back, {userName.split(" ")[0]}
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
                </div>
              </Panel>
            </FadeIn>

            <FadeIn>
              <Panel>
                <PanelHeader title="Quick actions" icon={CalendarDays} />
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
