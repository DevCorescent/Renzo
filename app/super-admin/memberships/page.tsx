import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: Super Admin — Memberships

const TIER_TONE: Record<string, "neutral" | "success" | "warning" | "info" | "primary"> = {
  SILVER: "info", GOLD: "warning", PLATINUM: "primary", CUSTOM: "neutral",
};

export default async function SuperAdminMembershipsPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  const [plans, recentMembers] = await Promise.all([
    prisma.membershipPlan.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { customers: true } },
        benefits: true,
      },
    }),
    prisma.customerMembership.findMany({
      where: { status: "ACTIVE" },
      orderBy: { purchasedAt: "desc" },
      take: 30,
      include: {
        customer: { select: { firstName: true, lastName: true, phone: true } },
        plan: { select: { name: true, tier: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Memberships</h1>
        <p className="mt-0.5 text-sm text-gray-500">{plans.length} plans · {recentMembers.length} active members</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className="rounded border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">{p.name}</p>
                <Badge tone={TIER_TONE[p.tier] ?? "neutral"} className="mt-1">{p.tier}</Badge>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-gray-900">₹{Number(p.price).toLocaleString("en-IN")}</p>
                <p className="text-xs text-gray-400">{p.validityDays} days</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400">{p._count.customers} active member{p._count.customers !== 1 ? "s" : ""}</p>
            {p.benefits.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {p.benefits.slice(0, 3).map((b) => (
                  <li key={b.id} className="text-[11px] text-gray-500">· {b.name}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Active Members</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Customer</TH><TH>Plan</TH><TH>Tier</TH><TH>Purchased</TH><TH>End Date</TH></tr></THead>
          <tbody>
            {recentMembers.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No active memberships.</td></tr>
            ) : (
              recentMembers.map((m) => (
                <TR key={m.id}>
                  <TD className="font-medium text-gray-900">
                    {m.customer.firstName} {m.customer.lastName}
                    {m.customer.phone && <p className="text-[11px] text-gray-400">{m.customer.phone}</p>}
                  </TD>
                  <TD className="text-gray-700">{m.plan.name}</TD>
                  <TD><Badge tone={TIER_TONE[m.plan.tier] ?? "neutral"}>{m.plan.tier}</Badge></TD>
                  <TD className="font-mono text-xs text-gray-500">{new Date(m.purchasedAt).toLocaleDateString("en-IN")}</TD>
                  <TD className="font-mono text-xs text-gray-500">{new Date(m.endDate).toLocaleDateString("en-IN")}</TD>
                </TR>
              ))
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
