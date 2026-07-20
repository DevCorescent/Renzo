import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { CancelBookingButton } from "@/components/appointments/cancel-booking-button";
import { EditAppointmentButton } from "@/components/appointments/edit-appointment-button";
import { BookingsTabs } from "./bookings-tabs";
import type { CalEvent } from "@/components/bookings/bookings-calendar";

// OWNER: Super Admin — Bookings (all branches)
// SUPER_ADMIN / OWNER see every branch's appointments and can cancel any active one
// via the shared status route.

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "primary"> = {
  PENDING: "neutral", CONFIRMED: "info", CHECKED_IN: "warning", STARTED: "primary",
  COMPLETED: "success", CANCELLED: "danger", NO_SHOW: "danger", RESCHEDULED: "info",
};

const PLATFORM_ROLES = ["SUPER_ADMIN", "OWNER"] as const;

export default async function SuperAdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const authUser = await getServerUser();
  if (!authUser || !PLATFORM_ROLES.includes(authUser.userType as (typeof PLATFORM_ROLES)[number])) {
    redirect("/login");
  }
  const sp = await searchParams;
  const statusFilter = sp.status ?? null;

  // Calendar window: start of the current month → +4 months, across all
  // branches, so the super-admin can plan ahead.
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 4, 1);

  const [appointments, upcoming] = await Promise.all([
    prisma.appointment.findMany({
      where: { ...(statusFilter ? { status: statusFilter as never } : {}) },
      orderBy: [{ appointmentDate: "desc" }, { startTime: "asc" }],
      take: 100,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        branch: { select: { id: true, name: true } },
        worker: { select: { id: true, firstName: true, lastName: true } },
        services: { include: { service: { select: { id: true, name: true } } } },
      },
    }),
    prisma.appointment.findMany({
      where: { appointmentDate: { gte: from, lt: to } },
      orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
      include: {
        customer: { select: { firstName: true, lastName: true } },
        branch: { select: { name: true } },
        worker: { select: { firstName: true, lastName: true } },
        services: { include: { service: { select: { name: true } } } },
      },
    }),
  ]);

  const calendarEvents: CalEvent[] = upcoming.map((a) => ({
    id: a.id,
    date: a.appointmentDate.toISOString().slice(0, 10),
    startTime: a.startTime,
    endTime: a.endTime,
    title: `${a.customer.firstName} ${a.customer.lastName ?? ""}`.trim(),
    services: a.services.map((s) => s.service.name).join(", ") || "—",
    worker: a.worker ? `${a.worker.firstName} ${a.worker.lastName}`.trim() : null,
    branch: a.branch.name,
    status: a.status,
    amount: Number(a.totalAmount),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Bookings</h1>
        <p className="mt-0.5 text-sm text-gray-500">{appointments.length} recent across all branches</p>
      </div>

      <BookingsTabs events={calendarEvents}>
      <Card>
        <CardHeader><CardTitle>All Bookings</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Date</TH>
              <TH>Time</TH>
              <TH>Customer</TH>
              <TH>Branch</TH>
              <TH>Service</TH>
              <TH>Worker</TH>
              <TH>Amount</TH>
              <TH>Status</TH>
              <TH className="text-right">Action</TH>
            </tr>
          </THead>
          <tbody>
            {appointments.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">No bookings yet.</td></tr>
            ) : (
              appointments.map((a) => (
                <TR key={a.id}>
                  <TD className="font-mono text-xs text-gray-500">{new Date(a.appointmentDate).toLocaleDateString("en-IN")}</TD>
                  <TD className="font-mono text-xs text-gray-600">{a.startTime}–{a.endTime}</TD>
                  <TD className="font-medium text-gray-900">
                    {a.customer.firstName} {a.customer.lastName}
                    <p className="text-[11px] font-normal text-gray-400">{a.customer.phone}</p>
                  </TD>
                  <TD className="text-gray-500">{a.branch.name}</TD>
                  <TD className="text-gray-600 text-xs">{a.services.map((s) => s.service.name).join(", ") || "—"}</TD>
                  <TD className="text-gray-500">{a.worker ? `${a.worker.firstName} ${a.worker.lastName}` : "—"}</TD>
                  <TD className="text-gray-700">₹{Number(a.totalAmount).toLocaleString("en-IN")}</TD>
                  <TD><Badge tone={STATUS_TONE[a.status] ?? "neutral"}>{a.status.replace(/_/g, " ")}</Badge></TD>
                  <TD className="text-right">
                    <span className="inline-flex flex-wrap items-start justify-end gap-1.5">
                      <EditAppointmentButton
                        appointmentId={a.id}
                        status={a.status}
                        appointmentDate={a.appointmentDate}
                        startTime={a.startTime}
                        endTime={a.endTime}
                        branchId={a.branch.id}
                        serviceId={a.services[0]?.service.id}
                        workerId={a.worker?.id}
                        mode="admin"
                      />
                      <CancelBookingButton appointmentId={a.id} status={a.status} />
                    </span>
                  </TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>
      </BookingsTabs>
    </div>
  );
}
