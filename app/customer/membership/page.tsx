import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge } from "@/components/shared/ui";

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
      include: { plan: { include: { benefits: true } } },
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
        <h1 className="text-xl font-semibold text-stone-100">Membership</h1>
      </div>

      {activeMembership ? (
        <div className="rounded-xl border border-gold/20 bg-gold/5 p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Active Plan</p>
                <Badge tone={TIER_TONE[activeMembership.plan.tier] ?? "neutral"}>{activeMembership.plan.tier}</Badge>
              </div>
              <p className="text-lg font-semibold text-stone-100">{activeMembership.plan.name}</p>
              <p className="mt-0.5 text-xs text-stone-500">
                Valid until {new Date(activeMembership.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <Badge tone="success">Active</Badge>
          </div>
          {activeMembership.plan.benefits.length > 0 && (
            <ul className="mt-4 space-y-1.5">
              {activeMembership.plan.benefits.map((b) => (
                <li key={b.id} className="flex items-start gap-2 text-sm text-stone-300">
                  <span className="text-emerald-400">✓</span> {b.name}
                  {b.value && <span className="text-stone-500">— {b.value}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-white/8 bg-stone-900/50 p-6 text-center">
          <p className="text-sm font-medium text-stone-300">No active membership</p>
          <p className="mt-1 text-xs text-stone-500">Choose a plan below to get started</p>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-stone-300">Available Plans</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allPlans.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-white/8 bg-stone-900 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-stone-100">{plan.name}</p>
                  <Badge tone={TIER_TONE[plan.tier] ?? "neutral"} className="mt-1">{plan.tier}</Badge>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-gold">₹{Number(plan.price).toLocaleString("en-IN")}</p>
                  <p className="text-xs text-stone-500">{plan.validityDays} days</p>
                </div>
              </div>
              {plan.discountPercent > 0 && (
                <p className="mt-2 text-xs text-stone-400">{plan.discountPercent}% off on services</p>
              )}
              {plan.walletCredit > 0 && (
                <p className="text-xs text-stone-400">₹{plan.walletCredit} wallet credit on purchase</p>
              )}
              {plan.benefits.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {plan.benefits.map((b) => (
                    <li key={b.id} className="text-xs text-stone-500">· {b.name}</li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="mt-4 w-full rounded-lg bg-gold py-2 text-sm font-semibold text-gold-foreground transition hover:bg-gold-soft"
              >
                Buy Now
              </button>
            </div>
          ))}
        </div>
      </div>

      {history.length > 0 && (
        <div className="rounded-xl border border-white/8 bg-stone-900">
          <div className="border-b border-white/8 px-4 py-3">
            <h2 className="text-sm font-semibold text-stone-200">Membership History</h2>
          </div>
          <div className="divide-y divide-white/5">
            {history.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-stone-200">{m.plan.name}</p>
                  <p className="text-xs text-stone-500">
                    {new Date(m.startDate).toLocaleDateString("en-IN")} – {new Date(m.endDate).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <Badge tone={m.status === "ACTIVE" ? "success" : m.status === "EXPIRED" ? "neutral" : "danger"}>{m.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
