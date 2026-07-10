import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: Branch Admin — Schedule

export default async function BranchAdminSchedulePage() {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/login");
  const branchId = authUser.branchId;

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const [workerShifts, availability] = await Promise.all([
    prisma.workerShift.findMany({
      where: { branchId, isActive: true },
      include: {
        worker: { select: { firstName: true, lastName: true, employeeCode: true } },
        shift: true,
      },
      orderBy: { startDate: "asc" },
    }),
    prisma.workerAvailability.findMany({
      where: {
        branchId,
        date: { gte: startOfWeek, lt: endOfWeek },
      },
      include: {
        worker: { select: { firstName: true, lastName: true } },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Schedule</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Week of {startOfWeek.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} –{" "}
          {endOfWeek.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Active Worker Shifts</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Worker</TH>
              <TH>Shift</TH>
              <TH>Hours</TH>
              <TH>Working Days</TH>
              <TH>From</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {workerShifts.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No active shifts assigned.</td></tr>
            ) : (
              workerShifts.map((ws) => (
                <TR key={ws.id}>
                  <TD className="font-medium text-gray-900">
                    {ws.worker.firstName} {ws.worker.lastName}
                    <p className="text-[11px] text-gray-400">{ws.worker.employeeCode}</p>
                  </TD>
                  <TD className="text-gray-700">{ws.shift.name}</TD>
                  <TD className="font-mono text-xs text-gray-600">
                    {ws.shift.startTime}–{ws.shift.endTime}
                  </TD>
                  <TD className="text-gray-500">
                    {ws.shift.workingDays.map((d) => DAYS[d]).join(", ")}
                  </TD>
                  <TD className="font-mono text-xs text-gray-500">
                    {new Date(ws.startDate).toLocaleDateString("en-IN")}
                  </TD>
                  <TD><Badge tone={ws.isActive ? "success" : "neutral"}>{ws.isActive ? "Active" : "Off"}</Badge></TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      {availability.length > 0 && (
        <Card>
          <CardHeader><CardTitle>This Week — Unavailability Blocks</CardTitle></CardHeader>
          <Table>
            <THead><tr><TH>Worker</TH><TH>Date</TH><TH>From</TH><TH>To</TH><TH>Reason</TH></tr></THead>
            <tbody>
              {availability.map((a) => (
                <TR key={a.id}>
                  <TD className="font-medium text-gray-900">{a.worker.firstName} {a.worker.lastName}</TD>
                  <TD className="font-mono text-xs text-gray-600">
                    {new Date(a.date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                  </TD>
                  <TD className="font-mono text-xs text-gray-600">{a.fromTime ?? "Full day"}</TD>
                  <TD className="font-mono text-xs text-gray-600">{a.toTime ?? "—"}</TD>
                  <TD className="text-gray-500 text-xs">{a.reason ?? "—"}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
