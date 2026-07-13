import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { redirect } from "next/navigation";
import { Badge, Card, CardHeader, CardTitle, Table, THead, TH, TR, TD } from "@/components/shared/ui";

export default async function InventorySuppliersPage() {
  const authUser = await getServerUser();
  if (!authUser) redirect("/login");

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true, purchaseOrders: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Suppliers</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {suppliers.length} suppliers · {suppliers.filter((s) => s.isActive).length} active
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Total Suppliers", value: suppliers.length },
          { label: "Active", value: suppliers.filter((s) => s.isActive).length },
          { label: "Inactive", value: suppliers.filter((s) => !s.isActive).length },
        ].map((s) => (
          <div key={s.label} className="rounded border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Suppliers</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Contact Person</TH>
              <TH>Phone</TH>
              <TH>Email</TH>
              <TH>GSTIN</TH>
              <TH>Products</TH>
              <TH>Orders</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <tbody>
            {suppliers.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No suppliers yet.</td></tr>
            ) : suppliers.map((s) => (
              <TR key={s.id}>
                <TD className="font-medium text-gray-900">{s.name}</TD>
                <TD className="text-gray-600">{s.contactPerson ?? "—"}</TD>
                <TD className="font-mono text-xs text-gray-500">{s.phone ?? "—"}</TD>
                <TD className="text-xs text-gray-500">{s.email ?? "—"}</TD>
                <TD className="font-mono text-xs text-gray-400">{s.gstin ?? "—"}</TD>
                <TD className="text-gray-700">{s._count.products}</TD>
                <TD className="text-gray-700">{s._count.purchaseOrders}</TD>
                <TD><Badge tone={s.isActive ? "success" : "neutral"}>{s.isActive ? "Active" : "Inactive"}</Badge></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
