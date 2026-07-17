import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { CheckInButton } from "@/components/reception/check-in-button";
import { AssignWorkerSelect } from "@/components/reception/assign-worker-select";

// OWNER: Hemant | MODULE: Reception Check-in

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

export default async function ReceptionCheckinPage() {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/login");
  const branchId = authUser.branchId;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const appointments = await prisma.appointment.findMany({
    where: {
      branchId,
      appointmentDate: { gte: today, lt: tomorrow },
      status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN", "STARTED", "RESCHEDULED"] },
    },
    orderBy: { startTime: "asc" },
    include: {
      customer: { select: { firstName: true, lastName: true, phone: true } },
      worker: { select: { id: true, firstName: true, lastName: true } },
      services: { include: { service: { select: { name: true, duration: true } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Check-in</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} — {appointments.length} active
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s Arrivals</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Appt #</TH>
              <TH>Time</TH>
              <TH>Customer</TH>
              <TH>Service</TH>
              <TH>Worker</TH>
              <TH>Duration</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <tbody>
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                  No active appointments today.
                </td>
              </tr>
            ) : (
              appointments.map((a) => {
                const totalDuration = a.services.reduce((sum, s) => sum + s.service.duration, 0);
                return (
                  <TR key={a.id}>
                    <TD className="font-mono text-xs text-gray-400">{a.appointmentNo}</TD>
                    <TD className="font-mono text-xs text-gray-600">
                      {a.startTime}–{a.endTime}
                    </TD>
                    <TD className="font-medium text-gray-900">
                      {a.customer.firstName} {a.customer.lastName}
                      <p className="text-[11px] font-normal text-gray-400">{a.customer.phone}</p>
                    </TD>
                    <TD className="text-gray-600 text-xs">
                      {a.services.map((s) => s.service.name).join(", ") || "—"}
                    </TD>
                    <TD className="text-gray-500">
                      {a.worker ? `${a.worker.firstName} ${a.worker.lastName}` : "—"}
                    </TD>
                    <TD className="text-gray-500">{totalDuration || a.totalDuration} min</TD>
                    <TD>
                      <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>
                        {a.status.replace(/_/g, " ")}
                      </Badge>
                    </TD>
                    <TD className="text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        <CheckInButton appointmentId={a.id} status={a.status} />
                        <AssignWorkerSelect
                          appointmentId={a.id}
                          status={a.status}
                          currentWorkerId={a.workerId}
                        />
                      </div>
                    </TD>
                  </TR>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
