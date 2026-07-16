import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge } from "@/components/shared/ui";
import { GiftCardShare } from "@/components/customer/gift-card-share";
import { CopyCodeButton } from "@/components/gift-cards/copy-code-button";

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
    include: { redemptions: { orderBy: { redeemedAt: "desc" } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-100">Gift Cards</h1>
        <p className="mt-0.5 text-sm text-stone-500">
          {giftCards.length} card{giftCards.length !== 1 ? "s" : ""}
        </p>
      </div>

      {giftCards.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-stone-900 px-4 py-8 text-center">
          <p className="text-sm text-stone-400">No gift cards yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {giftCards.map((gc) => {
            const now = new Date();
            const isExpired = gc.expiresAt && gc.expiresAt < now;
            return (
              <div key={gc.id} className="rounded-xl border border-white/8 bg-stone-900">
                <div className="flex items-start justify-between border-b border-white/8 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-1">
                      <p className="font-mono text-sm font-semibold text-stone-100 tracking-widest">{gc.code}</p>
                      <CopyCodeButton code={gc.code} className="text-stone-400 hover:bg-white/5 hover:text-stone-200" />
                    </div>
                    {gc.recipientName && <p className="text-xs text-stone-500">For: {gc.recipientName}</p>}
                  </div>
                  <Badge tone={isExpired ? "neutral" : STATUS_TONE[gc.status] ?? "neutral"}>
                    {isExpired ? "Expired" : gc.status}
                  </Badge>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Original Value</span>
                    <span className="font-medium text-stone-200">₹{Number(gc.value).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-500">Remaining Balance</span>
                    <span className={`font-semibold ${Number(gc.balance) > 0 ? "text-gold" : "text-stone-500"}`}>
                      ₹{Number(gc.balance).toLocaleString("en-IN")}
                    </span>
                  </div>
                  {gc.expiresAt && (
                    <div className="flex justify-between text-xs text-stone-500">
                      <span>Expires</span>
                      <span>{new Date(gc.expiresAt).toLocaleDateString("en-IN")}</span>
                    </div>
                  )}
                  {gc.redemptions.length > 0 && (
                    <div className="mt-3 border-t border-white/8 pt-2">
                      <p className="text-[11px] font-medium text-stone-500 mb-1">Redemptions</p>
                      {gc.redemptions.map((r) => (
                        <div key={r.id} className="flex justify-between text-xs text-stone-400">
                          <span>{new Date(r.redeemedAt).toLocaleDateString("en-IN")}</span>
                          <span>₹{Number(r.amount).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Share/transfer — offered only while the card is usable. */}
                  {gc.status === "ACTIVE" && !isExpired && Number(gc.balance) > 0 && (
                    <div className="mt-3 flex justify-end border-t border-white/8 pt-3">
                      <GiftCardShare code={gc.code} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
