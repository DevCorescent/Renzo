import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge } from "@/components/shared/ui";

const TIER_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "primary"> = {
  BRONZE: "neutral", SILVER: "info", GOLD: "warning", DIAMOND: "primary",
};

const TX_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  EARNED: "success", REDEEMED: "danger", EXPIRED: "neutral", ADJUSTED: "info", REFERRAL_BONUS: "success",
};

export default async function CustomerLoyaltyPage() {
  const authUser = await getServerUser();
  if (!authUser?.customerId) redirect("/login");
  const customerId = authUser.customerId;

  const loyalty = await prisma.loyaltyAccount.findUnique({
    where: { customerId },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 50 } },
  });

  const config = await prisma.loyaltyConfig.findFirst({ where: { isActive: true } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-100">Loyalty</h1>
      </div>

      {loyalty ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/8 bg-stone-900 p-4">
              <p className="text-xs font-medium text-stone-500">Available Points</p>
              <p className="mt-2 text-2xl font-semibold text-gold">
                {loyalty.availablePoints.toLocaleString()}
              </p>
              {config && (
                <p className="text-[11px] text-stone-500">
                  ≈ ₹{(loyalty.availablePoints * config.redemptionValue).toLocaleString("en-IN")} value
                </p>
              )}
            </div>
            <div className="rounded-xl border border-white/8 bg-stone-900 p-4">
              <p className="text-xs font-medium text-stone-500">Tier</p>
              <div className="mt-2">
                <Badge tone={TIER_TONE[loyalty.tier] ?? "neutral"} className="text-sm px-3 py-1">
                  {loyalty.tier}
                </Badge>
              </div>
            </div>
            <div className="rounded-xl border border-white/8 bg-stone-900 p-4">
              <p className="text-xs font-medium text-stone-500">Lifetime Earned</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-400">
                {loyalty.lifetimeEarned.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-stone-900 p-4">
              <p className="text-xs font-medium text-stone-500">Lifetime Redeemed</p>
              <p className="mt-2 text-2xl font-semibold text-stone-300">
                {loyalty.lifetimeRedeemed.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-stone-900">
            <div className="border-b border-white/8 px-4 py-3">
              <h2 className="text-sm font-semibold text-stone-200">Points History</h2>
            </div>
            {loyalty.transactions.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-stone-500">No transactions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/8">
                    <tr>
                      {["Date", "Type", "Description", "Points", "Balance"].map((h, i) => (
                        <th key={h} className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-stone-500 ${i >= 3 ? "text-right" : "text-left"}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loyalty.transactions.map((t) => {
                      const isPos = t.type === "EARNED" || t.type === "REFERRAL_BONUS" || t.type === "ADJUSTED";
                      return (
                        <tr key={t.id}>
                          <td className="px-4 py-2.5 font-mono text-xs text-stone-500">
                            {new Date(t.createdAt).toLocaleDateString("en-IN")}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge tone={TX_TONE[t.type] ?? "neutral"}>{t.type.replace(/_/g, " ")}</Badge>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-stone-400">{t.description ?? "—"}</td>
                          <td className={`px-4 py-2.5 text-right font-medium ${isPos ? "text-emerald-400" : "text-red-400"}`}>
                            {isPos ? "+" : "−"}{Math.abs(t.points).toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-xs text-stone-400">
                            {t.balanceAfter.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-white/8 bg-stone-900 px-4 py-8 text-center">
          <p className="text-sm text-stone-400">
            No loyalty account yet. Points will be added after your first visit.
          </p>
        </div>
      )}
    </div>
  );
}
