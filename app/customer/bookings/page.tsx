export const dynamic = "force-dynamic";

import prisma from "@/lib/db";
import { CalendarDays, BarChart3, Wallet, Crown, Sparkles, User, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Panel, PanelHeader, ChartCard } from "@/components/dashboard/card";
import { BarCompareChart } from "@/components/dashboard/charts-lazy";
import { type BookingRow } from "@/components/dashboard/bookings-table";
import { BookingDateTimeFilter } from "./date-time-filter";
import { FadeIn, Stagger, StaggerItem } from "@/components/dashboard/motion";
import { statusTone } from "@/components/dashboard/status-badge";
import type { NotificationItem } from "@/components/dashboard/notifications";
import { THEME_ROOT_ID } from "@/components/dashboard/use-dash-theme";

// OWNER: Devanshi | MODULE: Customer Bookings
// UI-only. Queries below are READ-ONLY (counts / aggregates) and customer-scoped.

/* ── server-side helpers ──────────────────────────────────────────────────── */
const fullName = (f: string, l?: string | null) => `${f}${l ? ` ${l}` : ""}`.trim();

const STATUS_META: Record<string, { label: string }> = {
  COMPLETED: { label: "Completed" },
  CONFIRMED: { label: "Confirmed" },
  CHECKED_IN: { label: "Checked in" },
  STARTED: { label: "In service" },
  PENDING: { label: "Pending" },
  RESCHEDULED: { label: "Rescheduled" },
  NO_SHOW: { label: "No-show" },
  CANCELLED: { label: "Cancelled" },
};

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

  /* ── derive presentational data ─────────────────────────────────────────── */
  const userName = customer ? fullName(customer.firstName, customer.lastName) : "Guest";
  const totalSpent = Math.round(Number(spentAgg._sum.paidAmount ?? 0));
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = today.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

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

  // notifications (header bell) — most recently created bookings
  const recent = [...appointments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 5);
  const notifications: NotificationItem[] = recent.map((a) => ({
    id: a.id,
    title: `Booking · ${a.appointmentNo}`,
    meta: `${a.branch.name} · ${STATUS_META[a.status]?.label ?? a.status}`,
    tone: statusTone(a.status),
    unread: a.status === "PENDING" || a.status === "CONFIRMED",
    href: `/customer/bookings/${a.id}`,
  }));

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
        {/* ── Header (Quick actions button hidden) ───────────────────────── */}
        <FadeIn>
          <DashboardHeader
            role="customer"
            userName={userName}
            greeting={greeting}
            dateLabel={dateLabel}
            notifications={notifications}
            hideQuickActions
            hideThemeToggle
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

        {/* ── Main grid: history (left) · quick actions (right) ───────────── */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* LEFT */}
          <div className="space-y-6 xl:col-span-2">
            <FadeIn>
              <ChartCard title="Favourite services" subtitle="Most booked" icon={BarChart3}>
                {topServices.length ? (
                  <BarCompareChart data={topServices} />
                ) : (
                  <p className="py-16 text-center text-sm text-gray-400 dark:text-(--sa-muted)">No bookings yet.</p>
                )}
              </ChartCard>
            </FadeIn>

            <FadeIn>
              <Panel>
                <PanelHeader
                  title="Booking history"
                  subtitle={`${totalBookings} ${totalBookings === 1 ? "booking" : "bookings"}`}
                  icon={CalendarDays}
                />
                <BookingDateTimeFilter rows={bookingRows} />
              </Panel>
            </FadeIn>
          </div>

          {/* RIGHT — side panel */}
          <div className="space-y-6">
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
