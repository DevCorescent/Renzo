import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: Branch Admin — Inventory

export default async function BranchAdminInventoryPage() {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/login");
  const branchId = authUser.branchId;

  const stocks = await prisma.stock.findMany({
    where: { branchId },
    orderBy: { product: { name: "asc" } },
    include: {
      product: {
        select: {
          name: true, sku: true, unit: true,
          sellingPrice: true, reorderLevel: true,
          isRetail: true, isConsumable: true,
          category: { select: { name: true } },
        },
      },
    },
  });

  const lowStock = stocks.filter((s) => Number(s.quantity) < s.product.reorderLevel);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Inventory</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {stocks.length} products · {lowStock.length} below reorder level
        </p>
      </div>

      {lowStock.length > 0 && (
        <div className="rounded border border-red-100 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">Low Stock Alert — {lowStock.length} item{lowStock.length !== 1 ? "s" : ""} need restocking</p>
          <ul className="mt-1 space-y-0.5">
            {lowStock.slice(0, 5).map((s) => (
              <li key={s.id} className="text-xs text-red-600">
                {s.product.name} — {Number(s.quantity)} {s.product.unit} (reorder at {s.product.reorderLevel})
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Stock Levels</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Product</TH>
              <TH>SKU</TH>
              <TH>Category</TH>
              <TH>In Stock</TH>
              <TH>Reserved</TH>
              <TH>Reorder At</TH>
              <TH>Type</TH>
            </tr>
          </THead>
          <tbody>
            {stocks.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No stock records for this branch.</td></tr>
            ) : (
              stocks.map((s) => {
                const qty = Number(s.quantity);
                const isLow = qty < s.product.reorderLevel;
                return (
                  <TR key={s.id}>
                    <TD className="font-medium text-gray-900">{s.product.name}</TD>
                    <TD className="font-mono text-xs text-gray-400">{s.product.sku}</TD>
                    <TD className="text-gray-500">{s.product.category?.name ?? "—"}</TD>
                    <TD className={isLow ? "font-semibold text-red-600" : "text-gray-700"}>
                      {qty} {s.product.unit}
                      {isLow && <span className="ml-1 text-[10px] text-red-500">⚠</span>}
                    </TD>
                    <TD className="text-gray-400">{Number(s.reservedQty)} {s.product.unit}</TD>
                    <TD className="text-gray-400">{s.product.reorderLevel}</TD>
                    <TD>
                      {s.product.isRetail
                        ? <Badge tone="info">Retail</Badge>
                        : <Badge tone="neutral">Internal</Badge>}
                    </TD>
                  </TR>
                );
              })
            )}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
