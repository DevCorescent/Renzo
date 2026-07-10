import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { StatCard, Badge } from "@/components/shared/ui";
import { CalendarDays, CheckCircle, Clock } from "lucide-react";

// OWNER: Hemant | MODULE: Worker Dashboard

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

export default async function WorkerDashboardPage() {
  const authUser = await getServerUser();
  if (!authUser?.workerId) redirect("/login");
  const workerId = authUser.workerId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [worker, todayCount, completedCount, attendance, appointments] = await Promise.all([
    prisma.workerProfile.findUnique({
      where: { id: workerId },
      select: { firstName: true, lastName: true, designation: { select: { name: true } } },
    }),
    prisma.appointment.count({
      where: { workerId, appointmentDate: { gte: today, lt: tomorrow } },
    }),
    prisma.appointment.count({
      where: { workerId, status: "COMPLETED", appointmentDate: { gte: today, lt: tomorrow } },
    }),
    prisma.attendance.findFirst({
      where: { workerId, date: { gte: today, lt: tomorrow } },
      select: { checkIn: true, checkOut: true, status: true },
    }),
    prisma.appointment.findMany({
      where: { workerId, appointmentDate: { gte: today, lt: tomorrow } },
      orderBy: { startTime: "asc" },
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        branch: { select: { name: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          {worker?.firstName} {worker?.lastName}
          {worker?.designation?.name && (
            <span className="ml-2 text-base font-normal text-gray-400">
              · {worker.designation.name}
            </span>
          )}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {today.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Today's Bookings" value={todayCount.toString()} icon={CalendarDays} />
        <StatCard label="Completed" value={completedCount.toString()} icon={CheckCircle} />
        <StatCard
          label="Check-in"
          value={
            attendance?.checkIn
              ? new Date(attendance.checkIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
              : "Not marked"
          }
          icon={Clock}
        />
      </div>

      <div className="rounded border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Today's Schedule</h2>
        </div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-400">
              <th className="px-4 py-2.5">Time</th>
              <th className="px-4 py-2.5">Customer</th>
              <th className="px-4 py-2.5">Service</th>
              <th className="px-4 py-2.5">Branch</th>
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
                  <td className="px-4 py-3 text-gray-500">{a.branch.name}</td>
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
