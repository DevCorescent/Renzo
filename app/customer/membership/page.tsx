import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, CardBody } from "@/components/shared/ui";

// OWNER: Devanshi | MODULE: Customer — Membership

const TIER_TONE: Record<string, "neutral" | "success" | "warning" | "info" | "primary"> = {
  SILVER: "info", GOLD: "warning", PLATINUM: "primary", CUSTOM: "neutral",
};

export default async function CustomerMembershipPage() {
  const authUser = await getServerUser();
  if (!authUser?.customerId) redirect("/login");
  const customerId = authUser.customerId;

  const [activeMembership, allPlans, history] = await Promise.all([
    prisma.customerMembership.findFirst({
      where: { customerId, status: "ACTIVE" },
      include: {
        plan: { include: { benefits: true } },
      },
    }),
    prisma.membershipPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { benefits: true },
    }),
    prisma.customerMembership.findMany({
      where: { customerId },
      orderBy: { purchasedAt: "desc" },
      include: { plan: { select: { name: true, tier: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Membership</h1>
      </div>

      {activeMembership ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">Active Plan</span>
              <Badge tone={TIER_TONE[activeMembership.plan.tier] ?? "neutral"}>{activeMembership.plan.tier}</Badge>
            </div>
          </CardHeader>
          <CardBody>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold text-gray-900">{activeMembership.plan.name}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Valid until {new Date(activeMembership.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <Badge tone="success">Active</Badge>
            </div>
            {activeMembership.plan.benefits.length > 0 && (
              <ul className="mt-4 space-y-1.5">
                {activeMembership.plan.benefits.map((b) => (
                  <li key={b.id} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-green-600">✓</span> {b.name}
                    {b.value && <span className="text-gray-400">— {b.value}</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : (
        <div className="rounded border border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm font-medium text-gray-700">No active membership</p>
          <p className="mt-1 text-xs text-gray-400">Choose a plan below to get started</p>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Available Plans</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allPlans.map((plan) => (
            <div key={plan.id} className="rounded border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{plan.name}</p>
                  <Badge tone={TIER_TONE[plan.tier] ?? "neutral"} className="mt-1">{plan.tier}</Badge>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gray-900">₹{Number(plan.price).toLocaleString("en-IN")}</p>
                  <p className="text-xs text-gray-400">{plan.validityDays} days</p>
                </div>
              </div>
              {plan.discountPercent > 0 && (
                <p className="mt-2 text-xs text-gray-500">{plan.discountPercent}% off on services</p>
              )}
              {plan.walletCredit > 0 && (
                <p className="text-xs text-gray-500">₹{plan.walletCredit} wallet credit on purchase</p>
              )}
              {plan.benefits.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {plan.benefits.map((b) => (
                    <li key={b.id} className="text-xs text-gray-500">· {b.name}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Membership History</CardTitle></CardHeader>
          <div className="divide-y divide-gray-50">
            {history.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{m.plan.name}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(m.startDate).toLocaleDateString("en-IN")} – {new Date(m.endDate).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <Badge tone={m.status === "ACTIVE" ? "success" : m.status === "EXPIRED" ? "neutral" : "danger"}>{m.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
