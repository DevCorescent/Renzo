// OWNER: Hemant | MODULE: Global Inventory Management
import { Package, AlertTriangle, ArrowLeftRight, Truck } from "lucide-react";
import { PageHeader, StatCard, Card, CardHeader, CardTitle, Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const products = [
  { name: "Argan Hair Serum", sku: "SKU-1042", total: 42, branches: 4, low: 1, tone: "warning" as const, label: "1 branch low" },
  { name: "Keratin Complex 500ml", sku: "SKU-2210", total: 88, branches: 5, low: 0, tone: "success" as const, label: "Healthy" },
  { name: "Colour Developer 20vol", sku: "SKU-3301", total: 19, branches: 4, low: 2, tone: "danger" as const, label: "2 branches low" },
  { name: "Disposable Towels", sku: "SKU-0087", total: 1240, branches: 5, low: 0, tone: "success" as const, label: "Healthy" },
];

export default function SuperAdminInventoryPage() {
  return (
    <>
      <PageHeader eyebrow="Supply Chain" title="Inventory" subtitle="Consolidated stock across all branches."
        actions={<><Button variant="outline" size="sm"><ArrowLeftRight /> Transfer</Button><Button size="sm"><Truck /> Purchase order</Button></>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="SKUs" value="212" icon={Package} />
        <StatCard label="Low Stock Alerts" value="7" hint="across branches" icon={AlertTriangle} />
        <StatCard label="Stock Value" value="₹18.4L" icon={Package} />
        <StatCard label="Open POs" value="5" hint="₹3.2L pending" icon={Truck} />
      </div>

      <Card>
        <CardHeader><CardTitle>Products</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Product</TH><TH>SKU</TH><TH>Total Qty</TH><TH>In Branches</TH><TH>Status</TH></tr></THead>
          <tbody>
            {products.map((p) => (
              <TR key={p.sku}>
                <TD className="font-medium">{p.name}</TD>
                <TD className="text-muted-foreground">{p.sku}</TD>
                <TD className="tabular-nums">{p.total}</TD>
                <TD className="tabular-nums text-muted-foreground">{p.branches}</TD>
                <TD><Badge tone={p.tone}>{p.label}</Badge></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
