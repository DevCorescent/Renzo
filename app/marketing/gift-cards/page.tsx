import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  REDEEMED: "neutral",
  EXPIRED: "neutral",
  CANCELLED: "danger",
};

export default async function MarketingGiftCardsPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");

  const giftCards = await prisma.giftCard.findMany({
    orderBy: { purchasedAt: "desc" },
    take: 100,
  });

  const now = new Date();
  const active = giftCards.filter((g) => g.status === "ACTIVE" && (!g.expiresAt || g.expiresAt > now)).length;
  const totalValue = giftCards.reduce((sum, g) => sum + Number(g.value), 0);
  const totalBalance = giftCards.reduce((sum, g) => sum + Number(g.balance), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Gift Cards</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {giftCards.length} cards · {active} active · ₹{Math.round(totalBalance).toLocaleString("en-IN")} outstanding balance
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Cards", value: giftCards.length },
          { label: "Active", value: active },
          { label: "Total Face Value", value: `₹${Math.round(totalValue).toLocaleString("en-IN")}` },
          { label: "Outstanding Balance", value: `₹${Math.round(totalBalance).toLocaleString("en-IN")}` },
        ].map((s) => (
          <div key={s.label} className="rounded border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Gift Cards</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Code</TH>
              <TH>Type</TH>
              <TH>Face Value</TH>
              <TH>Remaining</TH>
              <TH>Recipient</TH>
              <TH>Purchased</TH>
              <TH>Expires</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {giftCards.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No gift cards yet.</td></tr>
            ) : giftCards.map((g) => {
              const isExpired = g.expiresAt && g.expiresAt <= now;
              return (
                <TR key={g.id}>
                  <TD className="font-mono text-sm font-semibold tracking-widest text-gray-900">{g.code}</TD>
                  <TD><Badge tone="info">{g.type}</Badge></TD>
                  <TD className="font-medium text-gray-900">₹{Number(g.value).toLocaleString("en-IN")}</TD>
                  <TD className={Number(g.balance) === 0 ? "text-gray-400" : "font-medium text-gray-900"}>
                    ₹{Number(g.balance).toLocaleString("en-IN")}
                  </TD>
                  <TD className="text-gray-500">{g.recipientName ?? "—"}</TD>
                  <TD className="text-xs text-gray-500">
                    {new Date(g.purchasedAt).toLocaleDateString("en-IN")}
                  </TD>
                  <TD className="text-xs text-gray-500">
                    {g.expiresAt ? new Date(g.expiresAt).toLocaleDateString("en-IN") : "Never"}
                  </TD>
                  <TD>
                    {isExpired ? (
                      <Badge tone="neutral">Expired</Badge>
                    ) : (
                      <Badge tone={STATUS_TONE[g.status] ?? "neutral"}>{g.status}</Badge>
                    )}
                  </TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
