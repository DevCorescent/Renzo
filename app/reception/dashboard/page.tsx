import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { StatCard, Badge } from "@/components/shared/ui";
import { CalendarDays, UserCheck, IndianRupee, Clock } from "lucide-react";
import Link from "next/link";

// OWNER: Hemant | MODULE: Reception Dashboard

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

export default async function ReceptionDashboardPage() {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/login");
  const branchId = authUser.branchId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayCount, checkedInCount, revenueAgg, appointments] = await Promise.all([
    prisma.appointment.count({
      where: { branchId, appointmentDate: { gte: today, lt: tomorrow } },
    }),
    prisma.appointment.count({
      where: {
        branchId,
        status: { in: ["CHECKED_IN", "STARTED"] },
        appointmentDate: { gte: today, lt: tomorrow },
      },
    }),
    prisma.invoice.aggregate({
      _sum: { paidAmount: true },
      where: { branchId, createdAt: { gte: today, lt: tomorrow } },
    }),
    prisma.appointment.findMany({
      where: {
        branchId,
        appointmentDate: { gte: today, lt: tomorrow },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      orderBy: { startTime: "asc" },
      take: 30,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        worker: { select: { firstName: true, lastName: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    }),
  ]);

  const revenue = Number(revenueAgg._sum.paidAmount ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Reception — Today</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {today.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Bookings" value={todayCount.toString()} icon={CalendarDays} />
        <StatCard label="In Chair / Checked In" value={checkedInCount.toString()} icon={UserCheck} />
        <StatCard
          label="Pending Check-in"
          value={(appointments.filter((a) => a.status === "CONFIRMED" || a.status === "PENDING").length).toString()}
          icon={Clock}
        />
        <StatCard
          label="Revenue Today"
          value={`₹${revenue.toLocaleString("en-IN")}`}
          icon={IndianRupee}
        />
      </div>

      <div className="rounded border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Today's Queue</h2>
          <Link href="/reception/checkin" className="text-xs text-gray-500 hover:text-gray-800">
            Check-in →
          </Link>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400">
              <th className="px-4 py-2.5">Time</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Service</th>
              <th className="px-4 py-2.5">Worker</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  No appointments today.
                </td>
              </tr>
            ) : (
              appointments.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {a.startTime}–{a.endTime}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {a.customer.firstName} {a.customer.lastName}
                    <p className="text-[11px] font-normal text-gray-400">{a.customer.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {a.services.map((s) => s.service.name).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {a.worker ? `${a.worker.firstName} ${a.worker.lastName}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>
                      {a.status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
