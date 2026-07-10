import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { StatCard, Badge } from "@/components/shared/ui";
import { CalendarDays, Wallet, Sparkles, Crown } from "lucide-react";
import Link from "next/link";

// OWNER: Devanshi | MODULE: Customer Dashboard

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "primary"> = {
  PENDING: "neutral",
  CONFIRMED: "info",
  CHECKED_IN: "warning",
  STARTED: "primary",
  COMPLETED: "success",
  CANCELLED: "danger",
  NO_SHOW: "danger",
  RESCHEDULED: "info",
};

export default async function CustomerDashboardPage() {
  const authUser = await getServerUser();
  if (!authUser?.customerId) redirect("/login");
  const customerId = authUser.customerId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [customer, wallet, loyalty, activeMembership, upcomingAppointments, recentAppointments] =
    await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId },
        select: { firstName: true, totalVisits: true, totalSpend: true },
      }),
      prisma.wallet.findUnique({
        where: { customerId },
        select: { balance: true },
      }),
      prisma.loyaltyAccount.findUnique({
        where: { customerId },
        select: { availablePoints: true, tier: true },
      }),
      prisma.customerMembership.findFirst({
        where: { customerId, status: "ACTIVE" },
        include: { plan: { select: { name: true, tier: true } } },
      }),
      prisma.appointment.findMany({
        where: {
          customerId,
          appointmentDate: { gte: today },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
        orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
        take: 5,
        include: {
          branch: { select: { name: true } },
          services: { include: { service: { select: { name: true } } } },
        },
      }),
      prisma.appointment.findMany({
        where: {
          customerId,
          status: "COMPLETED",
        },
        orderBy: { appointmentDate: "desc" },
        take: 5,
        include: {
          branch: { select: { name: true } },
          services: { include: { service: { select: { name: true } } } },
        },
      }),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Welcome back, {customer?.firstName ?? "there"}!
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {customer?.totalVisits ?? 0} visits · ₹{Number(customer?.totalSpend ?? 0).toLocaleString("en-IN")} lifetime spend
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Wallet Balance"
          value={`₹${Number(wallet?.balance ?? 0).toLocaleString("en-IN")}`}
          icon={Wallet}
        />
        <StatCard
          label="Loyalty Points"
          value={(loyalty?.availablePoints ?? 0).toLocaleString()}
          hint={loyalty?.tier}
          icon={Sparkles}
        />
        <StatCard
          label="Upcoming"
          value={upcomingAppointments.length.toString()}
          icon={CalendarDays}
        />
        <StatCard
          label="Membership"
          value={activeMembership?.plan.name ?? "None"}
          hint={activeMembership ? activeMembership.plan.tier : undefined}
          icon={Crown}
        />
      </div>

      {upcomingAppointments.length > 0 && (
        <div className="rounded border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-700">Upcoming Appointments</h2>
            <Link href="/customer/bookings" className="text-xs text-gray-500 hover:text-gray-800">
              All bookings →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {upcomingAppointments.map((a) => (
              <div key={a.id} className="flex items-start justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {a.services.map((s) => s.service.name).join(", ") || "Appointment"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(a.appointmentDate).toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}{" "}
                    · {a.startTime} · {a.branch.name}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>
                  {a.status.replace(/_/g, " ")}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentAppointments.length > 0 && (
        <div className="rounded border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-700">Recent Visits</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {recentAppointments.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {a.services.map((s) => s.service.name).join(", ") || "Visit"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(a.appointmentDate).toLocaleDateString("en-IN")} · {a.branch.name}
                  </p>
                </div>
                <p className="text-sm font-medium text-gray-700">
                  ₹{Number(a.totalAmount).toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
