import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

export default async function InventoryProductsPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");

  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: {
      category: { select: { name: true } },
      supplier: { select: { name: true } },
      stocks: { select: { quantity: true } },
    },
  });

  const totalStock = products.reduce(
    (sum, p) => sum + p.stocks.reduce((s, st) => s + Number(st.quantity), 0),
    0
  );
  const lowCount = products.filter((p) => {
    const total = p.stocks.reduce((s, st) => s + Number(st.quantity), 0);
    return total <= p.reorderLevel;
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Products</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {products.length} items · {products.filter((p) => p.isActive).length} active · {lowCount} low stock
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Products", value: products.length },
          { label: "Active", value: products.filter((p) => p.isActive).length },
          { label: "Low Stock", value: lowCount },
          { label: "Total Units", value: totalStock.toLocaleString() },
        ].map((s) => (
          <div key={s.label} className="rounded border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
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
              <TH>Cost</TH>
              <TH>Price</TH>
              <TH>Stock</TH>
              <TH>Reorder At</TH>
              <TH>Type</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-400">No products yet.</td></tr>
            ) : products.map((p) => {
              const total = p.stocks.reduce((s, st) => s + Number(st.quantity), 0);
              const isLow = total <= p.reorderLevel;
              return (
                <TR key={p.id}>
                  <TD className="font-medium text-gray-900">{p.name}</TD>
                  <TD className="font-mono text-xs text-gray-400">{p.sku}</TD>
                  <TD className="text-gray-500">{p.category?.name ?? "—"}</TD>
                  <TD className="text-gray-500">{p.supplier?.name ?? "—"}</TD>
                  <TD className="text-gray-700">₹{Number(p.costPrice).toLocaleString("en-IN")}</TD>
                  <TD className="text-gray-700">₹{Number(p.sellingPrice).toLocaleString("en-IN")}</TD>
                  <TD className={isLow ? "font-medium text-red-600" : "text-gray-700"}>
                    {total.toLocaleString()}{isLow && <span className="ml-1 text-[10px]">⚠ low</span>}
                  </TD>
                  <TD className="text-gray-500">{p.reorderLevel}</TD>
                  <TD>{p.isRetail ? <Badge tone="info">Retail</Badge> : <Badge tone="neutral">Internal</Badge>}</TD>
                  <TD><Badge tone={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</Badge></TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
