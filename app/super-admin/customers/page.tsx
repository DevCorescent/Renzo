import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: Super Admin — Customers

export default async function SuperAdminCustomersPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      wallet: { select: { balance: true } },
      loyaltyAccount: { select: { availablePoints: true, tier: true } },
      _count: { select: { appointments: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Customers</h1>
        <p className="mt-0.5 text-sm text-gray-500">{customers.length} registered</p>
      </div>

      <Card>
        <CardHeader><CardTitle>All Customers</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Phone / Email</TH>
              <TH>Visits</TH>
              <TH>Total Spend</TH>
              <TH>Wallet</TH>
              <TH>Loyalty</TH>
              <TH>Status</TH>
              <TH className="text-right">Action</TH>
            </tr>
          </THead>
          <tbody>
            {customers.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No customers yet.</td></tr>
            ) : (
              customers.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium text-gray-900">{c.firstName} {c.lastName}</TD>
                  <TD className="text-gray-500 text-xs">
                    {c.phone && <p>{c.phone}</p>}
                    {c.email && <p className="text-gray-400">{c.email}</p>}
                  </TD>
                  <TD className="text-gray-500">{c._count.appointments}</TD>
                  <TD className="text-gray-700">₹{Number(c.totalSpend).toLocaleString("en-IN")}</TD>
                  <TD className="text-gray-500">₹{Number(c.wallet?.balance ?? 0).toLocaleString("en-IN")}</TD>
                  <TD>
                    {c.loyaltyAccount ? (
                      <span className="text-xs text-gray-500">
                        {c.loyaltyAccount.availablePoints.toLocaleString()} pts
                        <span className="ml-1 text-gray-400">({c.loyaltyAccount.tier})</span>
                      </span>
                    ) : "—"}
                  </TD>
                  <TD><Badge tone={c.isActive ? "success" : "danger"}>{c.isActive ? "Active" : "Inactive"}</Badge></TD>
                  <TD className="text-right">
                    <Link href={`/super-admin/customers/${c.id}`} className="text-xs font-medium text-gray-600 hover:underline">View</Link>
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
