import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Devanshi | MODULE: Customer Loyalty

const TIER_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info" | "primary"> = {
  BRONZE: "neutral",
  SILVER: "info",
  GOLD: "warning",
  DIAMOND: "primary",
};

const TX_TONE: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  EARNED: "success",
  REDEEMED: "danger",
  EXPIRED: "neutral",
  ADJUSTED: "info",
  REFERRAL_BONUS: "success",
};

export default async function CustomerLoyaltyPage() {
  const authUser = await getServerUser();
  if (!authUser?.customerId) redirect("/login");
  const customerId = authUser.customerId;

  const loyalty = await prisma.loyaltyAccount.findUnique({
    where: { customerId },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  const config = await prisma.loyaltyConfig.findFirst({ where: { isActive: true } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Loyalty</h1>
      </div>

      {loyalty ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">Available Points</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900">
                {loyalty.availablePoints.toLocaleString()}
              </p>
              {config && (
                <p className="text-[11px] text-gray-400">
                  ≈ ₹{(loyalty.availablePoints * config.redemptionValue).toLocaleString("en-IN")} value
                </p>
              )}
            </div>
            <div className="rounded border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">Tier</p>
              <div className="mt-2">
                <Badge tone={TIER_TONE[loyalty.tier] ?? "neutral"} className="text-sm px-3 py-1">
                  {loyalty.tier}
                </Badge>
              </div>
            </div>
            <div className="rounded border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">Lifetime Earned</p>
              <p className="mt-2 text-2xl font-semibold text-green-700">
                {loyalty.lifetimeEarned.toLocaleString()}
              </p>
            </div>
            <div className="rounded border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">Lifetime Redeemed</p>
              <p className="mt-2 text-2xl font-semibold text-gray-700">
                {loyalty.lifetimeRedeemed.toLocaleString()}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Points History</CardTitle>
            </CardHeader>
            {loyalty.transactions.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">No transactions yet.</p>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Date</TH>
                    <TH>Type</TH>
                    <TH>Description</TH>
                    <TH className="text-right">Points</TH>
                    <TH className="text-right">Balance</TH>
                  </tr>
                </THead>
                <tbody>
                  {loyalty.transactions.map((t) => (
                    <TR key={t.id}>
                      <TD className="font-mono text-xs text-gray-500">
                        {new Date(t.createdAt).toLocaleDateString("en-IN")}
                      </TD>
                      <TD>
                        <Badge tone={TX_TONE[t.type] ?? "neutral"}>
                          {t.type.replace(/_/g, " ")}
                        </Badge>
                      </TD>
                      <TD className="text-gray-500 text-xs">{t.description ?? "—"}</TD>
                      <TD
                        className={`text-right font-medium ${
                          t.type === "EARNED" || t.type === "REFERRAL_BONUS"
                            ? "text-green-700"
                            : "text-red-600"
                        }`}
                      >
                        {t.type === "EARNED" || t.type === "REFERRAL_BONUS" || t.type === "ADJUSTED"
                          ? "+"
                          : "−"}
                        {Math.abs(t.points).toLocaleString()}
                      </TD>
                      <TD className="text-right font-mono text-xs text-gray-700">
                        {t.balanceAfter.toLocaleString()}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            No loyalty account yet. Points will be added after your first visit.
          </p>
        </Card>
      )}
    </div>
  );
}
