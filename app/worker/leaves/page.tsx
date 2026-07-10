import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: Worker Leaves

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

export default async function WorkerLeavesPage() {
  const authUser = await getServerUser();
  if (!authUser?.workerId) redirect("/login");
  const workerId = authUser.workerId;

  const year = new Date().getFullYear();

  const [leaves, balances] = await Promise.all([
    prisma.leave.findMany({
      where: { workerId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { leaveType: { select: { name: true, code: true } } },
    }),
    prisma.leaveBalance.findMany({
      where: { workerId, year },
      include: { leaveType: { select: { name: true, code: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Leaves</h1>
        <p className="mt-0.5 text-sm text-gray-500">FY {year}</p>
      </div>

      {balances.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {balances.map((b) => (
            <div key={b.id} className="rounded border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">
                {b.leaveType.name} ({b.leaveType.code})
              </p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">{b.remaining}</p>
              <p className="text-xs text-gray-400">of {b.allocated} remaining</p>
            </div>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
        </CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Type</TH>
              <TH>From</TH>
              <TH>To</TH>
              <TH>Days</TH>
              <TH>Reason</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {leaves.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  No leave requests.
                </td>
              </tr>
            ) : (
              leaves.map((l) => (
                <TR key={l.id}>
                  <TD className="font-medium text-gray-900">
                    {l.leaveType.name}
                    <span className="ml-1 text-[11px] font-normal text-gray-400">
                      ({l.leaveType.code})
                    </span>
                  </TD>
                  <TD className="font-mono text-xs text-gray-600">
                    {new Date(l.startDate).toLocaleDateString("en-IN")}
                  </TD>
                  <TD className="font-mono text-xs text-gray-600">
                    {new Date(l.endDate).toLocaleDateString("en-IN")}
                  </TD>
                  <TD className="text-gray-500">{l.days}</TD>
                  <TD className="max-w-[200px] truncate text-gray-500 text-xs">{l.reason}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[l.status] ?? "neutral"}>
                      {l.status}
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
