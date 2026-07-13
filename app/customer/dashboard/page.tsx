import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { CalendarDays, Sparkles, Crown, Star } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/shared/ui";
import { DiscoverSection } from "./discover-section";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "primary"> = {
  PENDING: "neutral", CONFIRMED: "info", CHECKED_IN: "warning",
  STARTED: "primary", COMPLETED: "success", CANCELLED: "danger",
  NO_SHOW: "danger", RESCHEDULED: "info",
};

export default async function CustomerDashboardPage() {
  const authUser = await getServerUser();
  if (!authUser?.customerId) redirect("/login");
  const customerId = authUser.customerId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    customer,
    loyalty,
    activeMembership,
    upcomingAppointments,
    recentAppointments,
    popularServices,
    branches,
  ] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customerId },
      select: { firstName: true, totalVisits: true, totalSpend: true, gender: true },
    }),
    prisma.loyaltyAccount.findUnique({ where: { customerId }, select: { availablePoints: true, tier: true } }),
    prisma.customerMembership.findFirst({
      where: { customerId, status: "ACTIVE" },
      include: { plan: { select: { name: true, tier: true } } },
    }),
    prisma.appointment.findMany({
      where: { customerId, appointmentDate: { gte: today }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
      take: 5,
      include: {
        branch: { select: { name: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    }),
    prisma.appointment.findMany({
      where: { customerId, status: "COMPLETED" },
      orderBy: { appointmentDate: "desc" },
      take: 3,
      include: {
        branch: { select: { name: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    }),
    prisma.service.findMany({
      where: { isActive: true, category: { isActive: true } },
      orderBy: [{ isPopular: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      take: 30,
      select: {
        id: true, name: true, image: true, description: true,
        basePrice: true, duration: true, gender: true, isPopular: true,
        category: { select: { id: true, name: true } },
      },
    }),
    prisma.branch.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, slug: true, city: true,
        address: true, phone: true, coverImage: true, description: true,
      },
    }),
  ]);

  const stats = [
    {
      label: "Loyalty Points",
      value: (loyalty?.availablePoints ?? 0).toLocaleString(),
      sub: loyalty?.tier ?? "No tier yet",
      icon: Sparkles,
      accent: "text-violet-400",
      href: "/customer/loyalty",
    },
    {
      label: "Total Visits",
      value: (customer?.totalVisits ?? 0).toString(),
      sub: "all time",
      icon: Star,
      accent: "text-amber-400",
      href: "/customer/bookings",
    },
    {
      label: "Upcoming",
      value: upcomingAppointments.length.toString(),
      sub: "appointments",
      icon: CalendarDays,
      accent: "text-sky-400",
      href: "/customer/bookings",
    },
    {
      label: "Membership",
      value: activeMembership?.plan.name ?? "None",
      sub: activeMembership?.plan.tier ?? "Upgrade to unlock perks",
      icon: Crown,
      accent: "text-gold",
      href: "/customer/membership",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-stone-100">
          Welcome back, {customer?.firstName ?? "there"}!
        </h1>
        <p className="mt-0.5 text-sm text-stone-500">
          {customer?.totalVisits ?? 0} visits · ₹{Number(customer?.totalSpend ?? 0).toLocaleString("en-IN")} lifetime spend
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group rounded-xl border border-white/8 bg-stone-900 p-4 transition hover:border-white/15">
            <div className="flex items-center gap-2 text-stone-500">
              <s.icon className={`size-4 ${s.accent}`} />
              <span className="text-xs">{s.label}</span>
            </div>
            <p className="mt-2 text-xl font-semibold text-stone-100">{s.value}</p>
            {s.sub && <p className="text-[11px] text-stone-500">{s.sub}</p>}
          </Link>
        ))}
      </div>

      {/* Upcoming appointments */}
      {upcomingAppointments.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-stone-900">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-200">Upcoming Appointments</h2>
            <Link href="/customer/bookings" className="text-xs text-amber-400 hover:underline">
              All bookings →
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {upcomingAppointments.map((a) => (
              <div key={a.id} className="flex items-start justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-stone-100">
                    {a.services.map((s) => s.service.name).join(", ") || "Appointment"}
                  </p>
                  <p className="text-xs text-stone-500">
                    {new Date(a.appointmentDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                    {" · "}{a.startTime} · {a.branch.name}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>{a.status.replace(/_/g, " ")}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent visits (compact) */}
      {recentAppointments.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-stone-900">
          <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-200">Recent Visits</h2>
            <Link href="/customer/bookings" className="text-xs text-amber-400 hover:underline">
              Full history →
            </Link>
          </div>
          <div className="divide-y divide-white/5">
            {recentAppointments.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-stone-100">
                    {a.services.map((s) => s.service.name).join(", ") || "Visit"}
                  </p>
                  <p className="text-xs text-stone-500">
                    {new Date(a.appointmentDate).toLocaleDateString("en-IN")} · {a.branch.name}
                  </p>
                </div>
                <p className="text-sm font-medium text-stone-300">
                  ₹{Number(a.totalAmount).toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discovery: services + branches */}
      <DiscoverSection
        services={popularServices}
        branches={branches}
        customerGender={customer?.gender ?? null}
      />
    </div>
  );
}
