import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: Worker Bookings

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

export default async function WorkerBookingsPage() {
  const authUser = await getServerUser();
  if (!authUser?.workerId) redirect("/login");
  const workerId = authUser.workerId;

  const appointments = await prisma.appointment.findMany({
    where: { workerId },
    orderBy: [{ appointmentDate: "desc" }, { startTime: "asc" }],
    take: 100,
    include: {
      customer: { select: { firstName: true, lastName: true, phone: true } },
      branch: { select: { name: true } },
      services: { include: { service: { select: { name: true } } } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">My Bookings</h1>
        <p className="mt-0.5 text-sm text-gray-500">{appointments.length} appointments</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appointment History</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Date</TH>
              <TH>Time</TH>
              <TH>Customer</TH>
              <TH>Service</TH>
              <TH>Branch</TH>
              <TH>Amount</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {appointments.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  No bookings yet.
                </td>
              </tr>
            ) : (
              appointments.map((a) => (
                <TR key={a.id}>
                  <TD className="font-mono text-xs text-gray-500">
                    {new Date(a.appointmentDate).toLocaleDateString("en-IN")}
                  </TD>
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
                  <TD className="text-gray-500">{a.branch.name}</TD>
                  <TD className="text-gray-700">₹{Number(a.totalAmount).toLocaleString("en-IN")}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[a.status] ?? "neutral"}>
                      {a.status.replace(/_/g, " ")}
                    </Badge>
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
