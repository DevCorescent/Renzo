// OWNER: Hemant | MODULE: Services & Categories Management
import { Plus } from "lucide-react";
import { PageHeader, Card, CardHeader, CardTitle, CardBody, Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const categories = [
  { name: "Hair", count: 24, active: true },
  { name: "Colour", count: 18, active: true },
  { name: "Skin & Facial", count: 15, active: true },
  { name: "Nails", count: 12, active: true },
  { name: "Bridal", count: 8, active: true },
  { name: "Spa", count: 10, active: false },
];

const services = [
  { name: "Haircut & Style", cat: "Hair", dur: "45m", price: "₹800", status: "Active", tone: "success" as const },
  { name: "Balayage", cat: "Colour", dur: "120m", price: "₹4,500", status: "Active", tone: "success" as const },
  { name: "Keratin Treatment", cat: "Hair", dur: "150m", price: "₹6,000", status: "Active", tone: "success" as const },
  { name: "Classic Facial", cat: "Skin & Facial", dur: "60m", price: "₹1,600", status: "Active", tone: "success" as const },
  { name: "Bridal Makeup", cat: "Bridal", dur: "180m", price: "₹15,000", status: "Active", tone: "success" as const },
  { name: "Aroma Spa", cat: "Spa", dur: "90m", price: "₹3,200", status: "Hidden", tone: "neutral" as const },
];

export default function SuperAdminServicesPage() {
  return (
    <>
      <PageHeader eyebrow="Catalogue" title="Services" subtitle="Manage service categories and pricing."
        actions={<Button size="sm"><Plus /> New service</Button>} />

      <Card>
        <CardHeader><CardTitle>Categories</CardTitle></CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c.name} className={`inline-flex items-center gap-2 border px-3 py-1.5 text-sm ${c.active ? "border-border" : "border-dashed border-border text-muted-foreground"}`}>
              {c.name} <Badge tone={c.active ? "primary" : "neutral"}>{c.count}</Badge>
            </span>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Services</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Service</TH><TH>Category</TH><TH>Duration</TH><TH>Base Price</TH><TH>Status</TH></tr></THead>
          <tbody>
            {services.map((s) => (
              <TR key={s.name}>
                <TD className="font-medium">{s.name}</TD>
                <TD className="text-muted-foreground">{s.cat}</TD>
                <TD className="tabular-nums text-muted-foreground">{s.dur}</TD>
                <TD className="font-semibold tabular-nums">{s.price}</TD>
                <TD><Badge tone={s.tone}>{s.status}</Badge></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
