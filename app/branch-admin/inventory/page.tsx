// OWNER: Hemant | MODULE: Branch Inventory — stock levels + low-stock alerts
import { Package, AlertTriangle, TrendingDown } from "lucide-react";
import { PageHeader, StatCard, Card, CardHeader, CardTitle, Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const stock = [
  { name: "Argan Hair Serum", sku: "SKU-1042", qty: 4, reorder: 10, unit: "bottles", tone: "danger" as const, label: "Low" },
  { name: "Keratin Complex 500ml", sku: "SKU-2210", qty: 8, reorder: 6, unit: "bottles", tone: "success" as const, label: "OK" },
  { name: "Colour Developer 20vol", sku: "SKU-3301", qty: 3, reorder: 8, unit: "litres", tone: "danger" as const, label: "Low" },
  { name: "Disposable Towels", sku: "SKU-0087", qty: 240, reorder: 100, unit: "pcs", tone: "success" as const, label: "OK" },
  { name: "Ammonia-free Colour (Ash)", sku: "SKU-3355", qty: 7, reorder: 10, unit: "tubes", tone: "warning" as const, label: "Watch" },
];

export default function BranchInventoryPage() {
  return (
    <>
      <PageHeader eyebrow="Bandra Branch" title="Inventory" subtitle="Stock on hand at this branch."
        actions={<Button size="sm">Request transfer</Button>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="SKUs Tracked" value="86" icon={Package} />
        <StatCard label="Low Stock" value="2" hint="need reorder" icon={AlertTriangle} />
        <StatCard label="Consumed (7d)" value="₹14,800" delta={{ value: "5%", positive: false }} icon={TrendingDown} />
      </div>

      <Card>
        <CardHeader><CardTitle>Stock Levels</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Product</TH><TH>SKU</TH><TH>On Hand</TH><TH>Reorder At</TH><TH>Status</TH></tr></THead>
          <tbody>
            {stock.map((s) => (
              <TR key={s.sku}>
                <TD className="font-medium">{s.name}</TD>
                <TD className="text-muted-foreground">{s.sku}</TD>
                <TD className="tabular-nums">{s.qty} <span className="text-xs text-muted-foreground">{s.unit}</span></TD>
                <TD className="tabular-nums text-muted-foreground">{s.reorder}</TD>
                <TD><Badge tone={s.tone}>{s.label}</Badge></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
