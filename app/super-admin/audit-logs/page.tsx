import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: Super Admin — Audit Logs

const ACTION_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  CREATE: "success", UPDATE: "info", DELETE: "danger",
  LOGIN: "neutral", LOGOUT: "neutral", APPROVE: "success", REJECT: "danger",
};

export default async function SuperAdminAuditLogsPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { email: true, phone: true, userType: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Audit Logs</h1>
        <p className="mt-0.5 text-sm text-gray-500">Last {logs.length} entries</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Activity Log</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Time</TH>
              <TH>User</TH>
              <TH>Role</TH>
              <TH>Action</TH>
              <TH>Module</TH>
              <TH>Ref</TH>
              <TH>IP</TH>
            </tr>
          </THead>
          <tbody>
            {logs.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No audit logs yet.</td></tr>
            ) : (
              logs.map((l) => (
                <TR key={l.id}>
                  <TD className="font-mono text-[11px] text-gray-500 whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleString("en-IN")}
                  </TD>
                  <TD className="text-xs text-gray-700">{l.user.email ?? l.user.phone ?? l.userId.slice(0, 8)}</TD>
                  <TD className="text-xs text-gray-400">{l.user.userType}</TD>
                  <TD><Badge tone={ACTION_TONE[l.action] ?? "neutral"}>{l.action}</Badge></TD>
                  <TD className="text-gray-500 text-xs">{l.module}</TD>
                  <TD className="font-mono text-[11px] text-gray-400">{l.refId?.slice(0, 12) ?? "—"}</TD>
                  <TD className="font-mono text-[11px] text-gray-400">{l.ipAddress ?? "—"}</TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
