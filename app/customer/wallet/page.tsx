import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge } from "@/components/shared/ui";

export default async function CustomerWalletPage() {
  const authUser = await getServerUser();
  if (!authUser?.customerId) redirect("/login");
  const customerId = authUser.customerId;

  const wallet = await prisma.wallet.findUnique({
    where: { customerId },
    include: {
      transactions: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  const balance = Number(wallet?.balance ?? 0);
  const totalAdded = Number(wallet?.totalAdded ?? 0);
  const totalUsed = Number(wallet?.totalUsed ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-100">Wallet</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/8 bg-stone-900 p-4">
          <p className="text-xs font-medium text-stone-500">Current Balance</p>
          <p className="mt-2 text-2xl font-semibold text-gold">₹{balance.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-stone-900 p-4">
          <p className="text-xs font-medium text-stone-500">Total Added</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-400">₹{totalAdded.toLocaleString("en-IN")}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-stone-900 p-4">
          <p className="text-xs font-medium text-stone-500">Total Used</p>
          <p className="mt-2 text-2xl font-semibold text-red-400">₹{totalUsed.toLocaleString("en-IN")}</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/8 bg-stone-900">
        <div className="border-b border-white/8 px-4 py-3">
          <h2 className="text-sm font-semibold text-stone-200">Transaction History</h2>
        </div>
        {!wallet ? (
          <p className="px-4 py-8 text-center text-sm text-stone-500">
            No wallet found. It will be created on your first transaction.
          </p>
        ) : wallet.transactions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-stone-500">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-white/8">
                <tr>
                  {["Date", "Type", "Source", "Description", "Amount", "Balance"].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-stone-500 ${i >= 4 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {wallet.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2.5 font-mono text-xs text-stone-500">
                      {new Date(t.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={t.type === "CREDIT" ? "success" : "danger"}>{t.type}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-stone-400">{t.source}</td>
                    <td className="px-4 py-2.5 text-xs text-stone-400">{t.description ?? "—"}</td>
                    <td className={`px-4 py-2.5 text-right font-medium ${t.type === "CREDIT" ? "text-emerald-400" : "text-red-400"}`}>
                      {t.type === "CREDIT" ? "+" : "−"}₹{Number(t.amount).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-stone-400">
                      ₹{Number(t.balanceAfter).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
