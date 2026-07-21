import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { CancelBookingButton } from "@/components/appointments/cancel-booking-button";
import { EditAppointmentButton } from "@/components/appointments/edit-appointment-button";

// OWNER: Hemant | MODULE: Branch Admin Appointments

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

export default async function BranchAdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; date?: string }>;
}) {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/login");
  const branchId = authUser.branchId;
  const sp = await searchParams;

  const dateFilter = sp.date ? new Date(sp.date) : null;
  const statusFilter = sp.status ?? null;

  const appointments = await prisma.appointment.findMany({
    where: {
      branchId,
      ...(statusFilter ? { status: statusFilter as never } : {}),
      ...(dateFilter
        ? {
            appointmentDate: {
              gte: dateFilter,
              lt: new Date(dateFilter.getTime() + 86400000),
            },
          }
        : {}),
    },
    orderBy: [{ appointmentDate: "desc" }, { startTime: "asc" }],
    take: 100,
    include: {
      customer: { select: { firstName: true, lastName: true, phone: true } },
      worker: { select: { id: true, firstName: true, lastName: true } },
      services: { include: { service: { select: { id: true, name: true } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-[var(--sa-text)]">Appointments</h1>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-[var(--sa-muted)]">{appointments.length} records</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Appointments</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Date</TH>
              <TH>Time</TH>
              <TH>Customer</TH>
              <TH>Service</TH>
              <TH>Worker</TH>
              <TH>Amount</TH>
              <TH>Status</TH>
              <TH className="text-right">Action</TH>
            </tr>
          </THead>
          <tbody>
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400 dark:text-[var(--sa-muted)]">
                  No appointments found.
                </td>
              </tr>
            ) : (
              appointments.map((a) => (
                <TR key={a.id}>
                  <TD className="font-mono text-xs text-gray-500 dark:text-[var(--sa-muted)]">
                    {new Date(a.appointmentDate).toLocaleDateString("en-IN")}
                  </TD>
                  <TD className="font-mono text-xs text-gray-600 dark:text-[var(--sa-text-2)]">
                    {a.startTime}–{a.endTime}
                  </TD>
                  <TD className="font-medium text-gray-900 dark:text-[var(--sa-text)]">
                    {a.customer.firstName} {a.customer.lastName}
                    <p className="text-[11px] font-normal text-gray-400 dark:text-[var(--sa-muted)]">{a.customer.phone}</p>
                  </TD>
                  <TD className="text-gray-600 dark:text-[var(--sa-text-2)]">
                    {a.services.map((s) => s.service.name).join(", ") || "—"}
                  </TD>
                  <TD className="text-gray-500 dark:text-[var(--sa-muted)]">
                    {a.worker ? `${a.worker.firstName} ${a.worker.lastName}` : "—"}
                  </TD>
                  <TD className="text-gray-700 dark:text-[var(--sa-text-2)]">
                    ₹{Number(a.totalAmount).toLocaleString("en-IN")}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>
                      {a.status.replace(/_/g, " ")}
                    </Badge>
                  </TD>
                  <TD className="text-right">
                    <span className="inline-flex flex-wrap items-start justify-end gap-1.5">
                      <EditAppointmentButton
                        appointmentId={a.id}
                        status={a.status}
                        appointmentDate={a.appointmentDate}
                        startTime={a.startTime}
                        endTime={a.endTime}
                        branchId={branchId}
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
    </div>
  );
}
