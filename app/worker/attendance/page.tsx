import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { ClockActions } from "@/components/worker/attendance/clock-actions";
import { BreakSpan } from "@/components/attendance/break-span";
import { attendanceDateKey } from "@/lib/attendance";

// OWNER: Hemant | MODULE: Worker Attendance

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PRESENT: "success",
  ABSENT: "danger",
  HALF_DAY: "warning",
  LATE: "warning",
  ON_LEAVE: "info",
};

export default async function WorkerAttendancePage() {
  const authUser = await getServerUser();
  if (!authUser?.workerId) redirect("/login");
  const workerId = authUser.workerId;

  // The salon's (IST) calendar day — the key every clock action writes. The UTC
  // date used here before was still "yesterday" until 05:30 IST.
  const today = attendanceDateKey();
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const [records, todayRecord, carriedBreak] = await Promise.all([
    prisma.attendance.findMany({
      where: { workerId },
      orderBy: { date: "desc" },
      take: 60,
      include: { branch: { select: { name: true } } },
    }),
    prisma.attendance.findUnique({
      where: { workerId_date: { workerId, date: today } },
      select: { checkIn: true, checkOut: true, breakStart: true, breakEnd: true },
    }),
    // A lunch break started before midnight and not yet ended (End break closes
    // it on the day it began — lib/attendance-api.ts applyClock).
    prisma.attendance.findFirst({
      where: { workerId, date: yesterday, breakStart: { not: null }, breakEnd: null, checkOut: null },
      select: { breakStart: true },
    }),
  ]);

  const openBreak = !todayRecord?.breakStart && carriedBreak?.breakStart ? carriedBreak.breakStart : null;
  const breakStart = todayRecord?.breakStart ?? openBreak;

  const presentCount = records.filter((r) => r.status === "PRESENT").length;
  const absentCount = records.filter((r) => r.status === "ABSENT").length;
  const halfCount = records.filter((r) => r.status === "HALF_DAY").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Attendance</h1>
          <p className="mt-0.5 text-sm text-gray-500">Last {records.length} records</p>
        </div>
        <ClockActions
          checkedIn={Boolean(todayRecord?.checkIn) || Boolean(openBreak)}
          checkedOut={Boolean(todayRecord?.checkOut)}
          breakStart={breakStart ? breakStart.toISOString() : null}
          breakEnd={todayRecord?.breakEnd ? todayRecord.breakEnd.toISOString() : null}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Present</p>
          <p className="mt-2 text-2xl font-semibold text-green-700">{presentCount}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Absent</p>
          <p className="mt-2 text-2xl font-semibold text-red-600">{absentCount}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Half Day</p>
          <p className="mt-2 text-2xl font-semibold text-gray-700">{halfCount}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Records</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Date</TH>
              <TH>Branch</TH>
              <TH>Check In</TH>
              <TH>Check Out</TH>
              <TH>Lunch break</TH>
              <TH>Working Hrs</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  No attendance records.
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <TR key={r.id}>
                  <TD className="font-mono text-xs text-gray-600">
                    {new Date(r.date).toLocaleDateString("en-IN")}
                  </TD>
                  <TD className="text-gray-500">{r.branch.name}</TD>
                  <TD className="font-mono text-xs text-gray-600">
                    {r.checkIn
                      ? new Date(r.checkIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
                      : "—"}
                  </TD>
                  <TD className="font-mono text-xs text-gray-600">
                    {r.checkOut
                      ? new Date(r.checkOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
                      : "—"}
                  </TD>
                  <TD className="text-xs">
                    <BreakSpan breakStart={r.breakStart} breakEnd={r.breakEnd} />
                  </TD>
                  <TD className="text-gray-500">
                    {r.workingMinutes > 0 ? `${Math.floor(r.workingMinutes / 60)}h ${r.workingMinutes % 60}m` : "—"}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>
                      {r.status.replace(/_/g, " ")}
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
