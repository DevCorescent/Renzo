import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

export default async function InventoryStockPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");
  const branchFilter = authUser.branchId ? { branchId: authUser.branchId } : {};

  const stocks = await prisma.stock.findMany({
    where: branchFilter,
    orderBy: [{ branch: { name: "asc" } }, { product: { name: "asc" } }],
    include: {
      product: { select: { name: true, sku: true, reorderLevel: true, isActive: true } },
      branch: { select: { name: true } },
    },
  });

  const lowCount = stocks.filter((s) => Number(s.quantity) <= s.product.reorderLevel).length;
  const totalUnits = stocks.reduce((sum, s) => sum + Number(s.quantity), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Stock</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {stocks.length} stock entries · {totalUnits.toLocaleString()} total units · {lowCount} low
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Stock Entries", value: stocks.length },
          { label: "Total Units", value: totalUnits.toLocaleString() },
          { label: "Low / Out of Stock", value: lowCount },
        ].map((s) => (
          <div key={s.label} className="rounded border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Stock by Branch</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Branch</TH>
              <TH>Product</TH>
              <TH>SKU</TH>
              <TH>Quantity</TH>
              <TH>Reorder Level</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {stocks.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No stock data yet.</td></tr>
            ) : stocks.map((s) => {
              const qty = Number(s.quantity);
              const isLow = qty <= s.product.reorderLevel;
              const isOut = qty === 0;
              return (
                <TR key={s.id}>
                  <TD className="font-medium text-gray-900">{s.branch.name}</TD>
                  <TD className="text-gray-700">{s.product.name}</TD>
                  <TD className="font-mono text-xs text-gray-400">{s.product.sku}</TD>
                  <TD className={isOut ? "font-semibold text-red-600" : isLow ? "font-medium text-amber-600" : "text-gray-700"}>
                    {qty.toLocaleString()}
                  </TD>
                  <TD className="text-gray-500">{s.product.reorderLevel}</TD>
                  <TD>
                    {isOut ? (
                      <Badge tone="danger">Out of stock</Badge>
                    ) : isLow ? (
                      <Badge tone="warning">Low</Badge>
                    ) : (
                      <Badge tone="success">OK</Badge>
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
