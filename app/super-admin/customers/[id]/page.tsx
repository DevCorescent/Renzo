import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect, notFound } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, CardBody, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: Super Admin — Customer Detail

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "primary"> = {
  PENDING: "neutral", CONFIRMED: "info", CHECKED_IN: "warning",
  STARTED: "primary", COMPLETED: "success", CANCELLED: "danger",
  NO_SHOW: "danger", RESCHEDULED: "info",
};

export default async function SuperAdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      wallet: { include: { transactions: { orderBy: { createdAt: "desc" }, take: 10 } } },
      loyaltyAccount: { include: { transactions: { orderBy: { createdAt: "desc" }, take: 10 } } },
      appointments: {
        orderBy: { appointmentDate: "desc" },
        take: 20,
        include: {
          branch: { select: { name: true } },
          services: { include: { service: { select: { name: true } } } },
        },
      },
      memberships: {
        include: { plan: { select: { name: true, tier: true } } },
        orderBy: { purchasedAt: "desc" },
      },
    },
  });

  if (!customer) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{customer.firstName} {customer.lastName}</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {customer.phone} {customer.email ? `· ${customer.email}` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Total Spend</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">₹{Number(customer.totalSpend).toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Total Visits</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{customer.totalVisits}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Wallet Balance</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">₹{Number(customer.wallet?.balance ?? 0).toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Loyalty Points</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{(customer.loyaltyAccount?.availablePoints ?? 0).toLocaleString()}</p>
          <p className="text-[11px] text-gray-400">{customer.loyaltyAccount?.tier ?? "No account"}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Appointments ({customer.appointments.length})</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Date</TH><TH>Service</TH><TH>Branch</TH><TH>Amount</TH><TH>Status</TH></tr></THead>
          <tbody>
            {customer.appointments.map((a) => (
              <TR key={a.id}>
                <TD className="font-mono text-xs text-gray-500">{new Date(a.appointmentDate).toLocaleDateString("en-IN")}</TD>
                <TD className="text-gray-700 text-xs">{a.services.map((s) => s.service.name).join(", ") || "—"}</TD>
                <TD className="text-gray-500">{a.branch.name}</TD>
                <TD className="text-gray-700">₹{Number(a.totalAmount).toLocaleString("en-IN")}</TD>
                <TD><Badge tone={STATUS_TONE[a.status] ?? "neutral"}>{a.status.replace(/_/g, " ")}</Badge></TD>
              </TR>
            ))}
            {customer.appointments.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">No appointments.</td></tr>
            )}
          </tbody>
        </Table>
      </Card>

      {customer.memberships.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Memberships</CardTitle></CardHeader>
          <Table>
            <THead><tr><TH>Plan</TH><TH>Tier</TH><TH>Start</TH><TH>End</TH><TH>Status</TH></tr></THead>
            <tbody>
              {customer.memberships.map((m) => (
                <TR key={m.id}>
                  <TD className="font-medium text-gray-900">{m.plan.name}</TD>
                  <TD className="text-gray-500">{m.plan.tier}</TD>
                  <TD className="font-mono text-xs text-gray-500">{new Date(m.startDate).toLocaleDateString("en-IN")}</TD>
                  <TD className="font-mono text-xs text-gray-500">{new Date(m.endDate).toLocaleDateString("en-IN")}</TD>
                  <TD><Badge tone={m.status === "ACTIVE" ? "success" : m.status === "EXPIRED" ? "neutral" : "danger"}>{m.status}</Badge></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
