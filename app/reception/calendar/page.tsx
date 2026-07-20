import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { BookingsCalendar, type CalEvent } from "@/components/bookings/bookings-calendar";

// OWNER: Reception — Bookings Calendar
// Month view of this branch's appointments so the front desk can see today,
// tomorrow and upcoming days at a glance. Branch-scoped from the session.

export default async function ReceptionCalendarPage() {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/staff/login");
  const branchId = authUser.branchId;

  // Window: start of the current month → +4 months, enough for planning ahead
  // while keeping the payload bounded.
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 4, 1);

  const appointments = await prisma.appointment.findMany({
    where: { branchId, appointmentDate: { gte: from, lt: to } },
    orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
    include: {
      customer: { select: { firstName: true, lastName: true } },
      worker: { select: { firstName: true, lastName: true } },
      services: { include: { service: { select: { name: true } } } },
    },
  });

  const events: CalEvent[] = appointments.map((a) => ({
    id: a.id,
    date: a.appointmentDate.toISOString().slice(0, 10),
    startTime: a.startTime,
    endTime: a.endTime,
    title: `${a.customer.firstName} ${a.customer.lastName ?? ""}`.trim(),
    services: a.services.map((s) => s.service.name).join(", ") || "—",
    worker: a.worker ? `${a.worker.firstName} ${a.worker.lastName}`.trim() : null,
    status: a.status,
    amount: Number(a.totalAmount),
    href: "/reception/checkin",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Bookings Calendar</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {events.length} upcoming appointments — click a day to see its schedule
        </p>
      </div>
      <BookingsCalendar events={events} />
    </div>
  );
}
