import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

const STATUS_TONE: Record<string, "neutral" | "success" | "warning" | "info" | "danger"> = {
  DRAFT: "neutral",
  ORDERED: "info",
  PARTIAL: "warning",
  RECEIVED: "success",
  CANCELLED: "danger",
};

export default async function InventoryPurchasesPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");
  const branchFilter = authUser.branchId ? { branchId: authUser.branchId } : {};

  const orders = await prisma.purchaseOrder.findMany({
    where: branchFilter,
    orderBy: { createdAt: "desc" },
    include: {
      supplier: { select: { name: true } },
      branch: { select: { name: true } },
      items: { select: { orderedQty: true, receivedQty: true, totalPrice: true } },
    },
  });

  const pending = orders.filter((o) => ["DRAFT", "ORDERED", "PARTIAL"].includes(o.status)).length;
  const totalValue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Purchase Orders</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {orders.length} orders · {pending} pending
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Orders", value: orders.length },
          { label: "Pending", value: pending },
          { label: "Received", value: orders.filter((o) => o.status === "RECEIVED").length },
          { label: "Total Value", value: `₹${Math.round(totalValue).toLocaleString("en-IN")}` },
        ].map((s) => (
          <div key={s.label} className="rounded border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Purchase Orders</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Order No.</TH>
              <TH>Supplier</TH>
              <TH>Branch</TH>
              <TH>Items</TH>
              <TH>Total</TH>
              <TH>Ordered At</TH>
              <TH>Received At</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No purchase orders yet.</td></tr>
            ) : orders.map((o) => (
              <TR key={o.id}>
                <TD className="font-mono text-xs font-medium text-gray-700">{o.orderNo}</TD>
                <TD className="text-gray-700">{o.supplier.name}</TD>
                <TD className="text-gray-500">{o.branch.name}</TD>
                <TD className="text-gray-700">{o.items.length}</TD>
                <TD className="font-medium text-gray-900">₹{Number(o.totalAmount).toLocaleString("en-IN")}</TD>
                <TD className="text-xs text-gray-500">
                  {o.orderedAt ? new Date(o.orderedAt).toLocaleDateString("en-IN") : "—"}
                </TD>
                <TD className="text-xs text-gray-500">
                  {o.receivedAt ? new Date(o.receivedAt).toLocaleDateString("en-IN") : "—"}
                </TD>
                <TD><Badge tone={STATUS_TONE[o.status] ?? "neutral"}>{o.status}</Badge></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
