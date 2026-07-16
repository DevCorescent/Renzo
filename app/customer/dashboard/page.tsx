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

  type ApptRow = (typeof upcomingAppointments)[number];
  type RecentRow = (typeof recentAppointments)[number];
  type ApptSvc = ApptRow["services"][number];

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
      accent: "text-[#C4C9D1]",
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
      accent: "text-[#C4C9D1]",
      href: "/customer/membership",
    },
  ];

  return (
    <>
      <style>{`
        @keyframes dashSlide { from { opacity:0; transform: translateY(22px); } to { opacity:1; transform:none; } }
        @keyframes dashPop { from { opacity:0; transform: translateY(10px) scale(.94); } to { opacity:1; transform:none; } }
        .anim-slide { animation: dashSlide .6s cubic-bezier(.22,1,.36,1) both; }
        .anim-pop { animation: dashPop .55s cubic-bezier(.34,1.56,.64,1) both; }
        @media (prefers-reduced-motion: reduce){ .anim-slide,.anim-pop{ animation:none !important; } }
      `}</style>

      <div className="space-y-8">
        {/* Header */}
        <div className="anim-slide">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Welcome back, {customer?.firstName ?? "there"}! <span className="inline-block">👋</span>
          </h1>
          <p className="mt-1.5 text-sm text-stone-400">
            {customer?.totalVisits ?? 0} visits · ₹{Number(customer?.totalSpend ?? 0).toLocaleString("en-IN")} lifetime spend
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Link
              key={s.label}
              href={s.href}
              style={{ animationDelay: `${i * 80}ms` }}
              className="group anim-pop rounded-2xl border border-white/10 bg-gradient-to-b from-stone-800/70 to-stone-900/90 p-5 shadow-lg shadow-black/40 backdrop-blur transition-all duration-300 hover:-translate-y-1.5 hover:scale-[1.02] hover:border-white/25 hover:shadow-2xl hover:shadow-black/60"
            >
              <div className="flex items-center gap-2 text-stone-400">
                <s.icon className={`size-4 ${s.accent} transition-transform group-hover:scale-110`} />
                <span className="text-xs font-medium uppercase tracking-wide">{s.label}</span>
              </div>
              <p className="mt-3 text-2xl font-bold text-white">{s.value}</p>
              {s.sub && <p className="mt-0.5 text-xs text-stone-400">{s.sub}</p>}
            </Link>
          ))}
        </div>

        {/* Upcoming appointments */}
        {upcomingAppointments.length > 0 && (
          <div className="anim-slide overflow-hidden rounded-2xl border border-white/10 bg-stone-900/70 shadow-lg shadow-black/40 backdrop-blur" style={{ animationDelay: "120ms" }}>
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-base font-semibold text-white">Upcoming Appointments</h2>
              <Link href="/customer/bookings" className="text-xs font-medium text-[#C4C9D1] hover:underline">
                All bookings →
              </Link>
            </div>
            <div className="divide-y divide-white/5">
              {upcomingAppointments.map((a: ApptRow) => (
                <div key={a.id} className="flex items-start justify-between px-5 py-4 transition-colors hover:bg-white/5">
                  <div>
                    <p className="text-sm font-semibold text-stone-100">
                      {a.services.map((s: ApptSvc) => s.service.name).join(", ") || "Appointment"}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-400">
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
          <div className="anim-slide overflow-hidden rounded-2xl border border-white/10 bg-stone-900/70 shadow-lg shadow-black/40 backdrop-blur" style={{ animationDelay: "160ms" }}>
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <h2 className="text-base font-semibold text-white">Recent Visits</h2>
              <Link href="/customer/bookings" className="text-xs font-medium text-[#C4C9D1] hover:underline">
                Full history →
              </Link>
            </div>
            <div className="divide-y divide-white/5">
              {recentAppointments.map((a: RecentRow) => (
                <div key={a.id} className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-white/5">
                  <div>
                    <p className="text-sm font-semibold text-stone-100">
                      {a.services.map((s: ApptSvc) => s.service.name).join(", ") || "Visit"}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-400">
                      {new Date(a.appointmentDate).toLocaleDateString("en-IN")} · {a.branch.name}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-stone-100">
                    ₹{Number(a.totalAmount).toLocaleString("en-IN")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Discovery: services + branches */}
        <div className="anim-slide" style={{ animationDelay: "200ms" }}>
          <DiscoverSection
            services={popularServices}
            branches={branches}
            customerGender={customer?.gender ?? null}
          />
        </div>
      </div>
    </>
  );
}
