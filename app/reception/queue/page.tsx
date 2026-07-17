import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { QueueActions } from "@/components/reception/queue-actions";

// OWNER: Hemant | MODULE: Reception Queue

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

const STATUSES = ["PENDING", "CONFIRMED", "CHECKED_IN", "STARTED", "COMPLETED"];

export default async function ReceptionQueuePage() {
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
    },
    orderBy: { startTime: "asc" },
    include: {
      customer: { select: { firstName: true, lastName: true, phone: true } },
      worker: { select: { firstName: true, lastName: true } },
      services: { include: { service: { select: { name: true } } } },
      invoice: { select: { id: true } },
    },
  });

  const grouped = STATUSES.reduce<Record<string, typeof appointments>>((acc, s) => {
    acc[s] = appointments.filter((a) => a.status === s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Queue</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {STATUSES.map((status) => {
        const list = grouped[status] ?? [];
        if (list.length === 0) return null;
        return (
          <Card key={status}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>
                <CardTitle className="text-gray-500">— {list.length}</CardTitle>
              </div>
            </CardHeader>
            <Table>
              <THead>
                <tr>
                  <TH>Time</TH>
                  <TH>Customer</TH>
                  <TH>Service</TH>
                  <TH>Worker</TH>
                  <TH>Amount</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <tbody>
                {list.map((a) => (
                  <TR key={a.id}>
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
                    <TD className="text-gray-700">₹{Number(a.totalAmount).toLocaleString("en-IN")}</TD>
                    <TD className="text-right">
                      <QueueActions
                        appointmentId={a.id}
                        status={a.status}
                        workerId={a.workerId}
                        invoiceId={a.invoice?.id}
                      />
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </Card>
        );
      })}

      {appointments.length === 0 && (
        <Card>
          <p className="px-4 py-8 text-center text-sm text-gray-400">No appointments today.</p>
        </Card>
      )}
    </div>
  );
}
