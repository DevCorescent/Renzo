import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "info" | "danger"> = {
  PENDING: "neutral",
  IN_TRANSIT: "info",
  RECEIVED: "success",
  CANCELLED: "danger",
};

export default async function InventoryTransfersPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");

  const transfers = await prisma.stockTransfer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      fromBranch: { select: { name: true } },
      toBranch: { select: { name: true } },
      items: { select: { quantity: true } },
    },
  });

  const inTransit = transfers.filter((t) => t.status === "IN_TRANSIT").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Stock Transfers</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {transfers.length} transfers · {inTransit} in transit
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Transfers", value: transfers.length },
          { label: "In Transit", value: inTransit },
          { label: "Received", value: transfers.filter((t) => t.status === "RECEIVED").length },
          { label: "Cancelled", value: transfers.filter((t) => t.status === "CANCELLED").length },
        ].map((s) => (
          <div key={s.label} className="rounded border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Transfers</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Transfer No.</TH>
              <TH>From</TH>
              <TH>To</TH>
              <TH>Items</TH>
              <TH>Notes</TH>
              <TH>Sent At</TH>
              <TH>Received At</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {transfers.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No stock transfers yet.</td></tr>
            ) : transfers.map((t) => (
              <TR key={t.id}>
                <TD className="font-mono text-xs font-medium text-gray-700">{t.transferNo}</TD>
                <TD className="text-gray-700">{t.fromBranch.name}</TD>
                <TD className="text-gray-700">{t.toBranch.name}</TD>
                <TD className="text-gray-700">{t.items.length}</TD>
                <TD className="text-xs text-gray-500">{t.notes ?? "—"}</TD>
                <TD className="text-xs text-gray-500">
                  {t.sentAt ? new Date(t.sentAt).toLocaleDateString("en-IN") : "—"}
                </TD>
                <TD className="text-xs text-gray-500">
                  {t.receivedAt ? new Date(t.receivedAt).toLocaleDateString("en-IN") : "—"}
                </TD>
                <TD><Badge tone={STATUS_TONE[t.status] ?? "neutral"}>{t.status.replace(/_/g, " ")}</Badge></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
