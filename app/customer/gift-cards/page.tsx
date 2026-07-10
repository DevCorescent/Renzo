import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle } from "@/components/shared/ui";

// OWNER: Devanshi | MODULE: Customer — Gift Cards

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "danger"> = {
  ACTIVE: "success", REDEEMED: "neutral", EXPIRED: "neutral", CANCELLED: "danger",
};

export default async function CustomerGiftCardsPage() {
  const authUser = await getServerUser();
  if (!authUser?.customerId) redirect("/login");
  const customerId = authUser.customerId;

  const giftCards = await prisma.giftCard.findMany({
    where: { ownedBy: customerId },
    orderBy: { purchasedAt: "desc" },
    include: {
      redemptions: { orderBy: { redeemedAt: "desc" } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Gift Cards</h1>
        <p className="mt-0.5 text-sm text-gray-500">{giftCards.length} card{giftCards.length !== 1 ? "s" : ""}</p>
      </div>

      {giftCards.length === 0 ? (
        <Card><p className="px-4 py-8 text-center text-sm text-gray-400">No gift cards yet.</p></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {giftCards.map((gc) => {
            const isExpired = gc.expiresAt && gc.expiresAt < new Date();
            return (
              <Card key={gc.id}>
                <CardHeader>
                  <div>
                    <p className="font-mono text-sm font-semibold text-gray-900 tracking-widest">{gc.code}</p>
                    {gc.recipientName && <p className="text-xs text-gray-400">For: {gc.recipientName}</p>}
                  </div>
                  <Badge tone={isExpired ? "neutral" : STATUS_TONE[gc.status] ?? "neutral"}>
                    {isExpired ? "Expired" : gc.status}
                  </Badge>
                </CardHeader>
                <div className="px-4 py-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Original Value</span>
                    <span className="font-medium text-gray-900">₹{Number(gc.value).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Remaining Balance</span>
                    <span className={`font-semibold ${Number(gc.balance) > 0 ? "text-green-700" : "text-gray-400"}`}>
                      ₹{Number(gc.balance).toLocaleString("en-IN")}
                    </span>
                  </div>
                  {gc.expiresAt && (
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>Expires</span>
                      <span>{new Date(gc.expiresAt).toLocaleDateString("en-IN")}</span>
                    </div>
                  )}
                  {gc.redemptions.length > 0 && (
                    <div className="mt-3 border-t border-gray-100 pt-2">
                      <p className="text-[11px] font-medium text-gray-400 mb-1">Redemptions</p>
                      {gc.redemptions.map((r) => (
                        <div key={r.id} className="flex justify-between text-xs text-gray-500">
                          <span>{new Date(r.redeemedAt).toLocaleDateString("en-IN")}</span>
                          <span>₹{Number(r.amount).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
