import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Devanshi | MODULE: Customer Wallet

export default async function CustomerWalletPage() {
  const authUser = await getServerUser();
  if (!authUser?.customerId) redirect("/login");
  const customerId = authUser.customerId;

  const wallet = await prisma.wallet.findUnique({
    where: { customerId },
    include: {
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  const balance = Number(wallet?.balance ?? 0);
  const totalAdded = Number(wallet?.totalAdded ?? 0);
  const totalUsed = Number(wallet?.totalUsed ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Wallet</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Current Balance</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            ₹{balance.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Total Added</p>
          <p className="mt-2 text-2xl font-semibold text-green-700">
            ₹{totalAdded.toLocaleString("en-IN")}
          </p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Total Used</p>
          <p className="mt-2 text-2xl font-semibold text-red-600">
            ₹{totalUsed.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        {!wallet ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">
            No wallet found. It will be created on your first transaction.
          </p>
        ) : wallet.transactions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-400">No transactions yet.</p>
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Date</TH>
                <TH>Type</TH>
                <TH>Source</TH>
                <TH>Description</TH>
                <TH className="text-right">Amount</TH>
                <TH className="text-right">Balance</TH>
              </tr>
            </THead>
            <tbody>
              {wallet.transactions.map((t) => (
                <TR key={t.id}>
                  <TD className="font-mono text-xs text-gray-500">
                    {new Date(t.createdAt).toLocaleDateString("en-IN")}
                  </TD>
                  <TD>
                    <Badge tone={t.type === "CREDIT" ? "success" : "danger"}>
                      {t.type}
                    </Badge>
                  </TD>
                  <TD className="text-gray-500 text-xs">{t.source}</TD>
                  <TD className="text-gray-500 text-xs">{t.description ?? "—"}</TD>
                  <TD className={`text-right font-medium ${t.type === "CREDIT" ? "text-green-700" : "text-red-600"}`}>
                    {t.type === "CREDIT" ? "+" : "−"}₹{Number(t.amount).toLocaleString("en-IN")}
                  </TD>
                  <TD className="text-right font-mono text-xs text-gray-700">
                    ₹{Number(t.balanceAfter).toLocaleString("en-IN")}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
