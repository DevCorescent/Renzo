import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

// OWNER: Hemant | MODULE: Super Admin — Inventory

export default async function SuperAdminInventoryPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  const [products, stockSummary] = await Promise.all([
    prisma.product.findMany({
      orderBy: { name: "asc" },
      include: {
        category: { select: { name: true } },
        supplier: { select: { name: true } },
        stocks: { select: { quantity: true, branchId: true } },
      },
    }),
    prisma.stock.aggregate({ _sum: { quantity: true } }),
  ]);

  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.isActive).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Inventory</h1>
        <p className="mt-0.5 text-sm text-gray-500">{totalProducts} products · {activeProducts} active</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Total Products</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{totalProducts}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Total Stock Units</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{Number(stockSummary._sum.quantity ?? 0).toLocaleString()}</p>
        </div>
        <div className="rounded border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Retail Products</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{products.filter((p) => p.isRetail).length}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>All Products</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>SKU</TH>
              <TH>Category</TH>
              <TH>Supplier</TH>
              <TH>Unit Price</TH>
              <TH>Total Stock</TH>
              <TH>Type</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No products yet.</td></tr>
            ) : (
              products.map((p) => {
                const total = p.stocks.reduce((sum, s) => sum + Number(s.quantity), 0);
                const isLow = total < p.reorderLevel;
                return (
                  <TR key={p.id}>
                    <TD className="font-medium text-gray-900">{p.name}</TD>
                    <TD className="font-mono text-xs text-gray-400">{p.sku}</TD>
                    <TD className="text-gray-500">{p.category?.name ?? "—"}</TD>
                    <TD className="text-gray-500">{p.supplier?.name ?? "—"}</TD>
                    <TD className="text-gray-700">₹{Number(p.sellingPrice).toLocaleString("en-IN")}</TD>
                    <TD className={isLow ? "font-medium text-red-600" : "text-gray-700"}>
                      {total.toLocaleString()}
                      {isLow && <span className="ml-1 text-[10px]">⚠ low</span>}
                    </TD>
                    <TD>
                      {p.isRetail ? <Badge tone="info">Retail</Badge> : <Badge tone="neutral">Internal</Badge>}
                    </TD>
                    <TD><Badge tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Off"}</Badge></TD>
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
