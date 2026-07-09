// OWNER: Hemant | MODULE: Branch Reports — sales, worker performance, appointment stats
import { IndianRupee, CalendarDays, Repeat, Percent } from "lucide-react";
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardBody, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const week = [
  { d: "Mon", v: 62 }, { d: "Tue", v: 78 }, { d: "Wed", v: 55 }, { d: "Thu", v: 70 },
  { d: "Fri", v: 88 }, { d: "Sat", v: 100 }, { d: "Sun", v: 40 },
];

const performers = [
  { name: "Priya Nair", services: 112, revenue: "₹1.84L", rating: "4.9" },
  { name: "Zoya Khan", services: 98, revenue: "₹1.42L", rating: "4.8" },
  { name: "Arjun Singh", services: 87, revenue: "₹1.10L", rating: "4.7" },
  { name: "Neha Gupta", services: 76, revenue: "₹0.94L", rating: "4.9" },
];

const services = [
  { name: "Haircut & Style", count: 210, share: "28%" },
  { name: "Balayage", count: 96, share: "13%" },
  { name: "Keratin Treatment", count: 64, share: "9%" },
  { name: "Facial", count: 120, share: "16%" },
];

export default function BranchReportsPage() {
  return (
    <>
      <PageHeader eyebrow="Bandra · This Month" title="Reports" subtitle="Sales, performance and appointment trends."
        actions={<Button variant="outline" size="sm">Export CSV</Button>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue MTD" value="₹12.6L" delta={{ value: "14%", positive: true }} icon={IndianRupee} />
        <StatCard label="Appointments" value="742" delta={{ value: "6%", positive: true }} icon={CalendarDays} />
        <StatCard label="Rebook Rate" value="58%" delta={{ value: "3%", positive: true }} icon={Repeat} />
        <StatCard label="No-show Rate" value="4.2%" delta={{ value: "0.8%", positive: false }} icon={Percent} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Revenue by Day</CardTitle><span className="text-xs text-muted-foreground">This week</span></CardHeader>
          <CardBody>
            <div className="flex h-52 items-end gap-3">
              {week.map((b) => (
                <div key={b.d} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full bg-primary/80 hover:bg-primary" style={{ height: `${b.v}%` }} />
                  </div>
                  <span className="text-[0.65rem] text-muted-foreground">{b.d}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top Services</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            {services.map((s) => (
              <div key={s.name} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span>{s.name}</span>
                  <span className="text-muted-foreground tabular-nums">{s.count} · {s.share}</span>
                </div>
                <div className="h-1.5 w-full bg-muted"><div className="h-full bg-primary" style={{ width: s.share }} /></div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Worker Performance</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Stylist</TH><TH>Services</TH><TH>Revenue</TH><TH>Rating</TH></tr></THead>
          <tbody>
            {performers.map((p) => (
              <TR key={p.name}>
                <TD className="font-medium">{p.name}</TD>
                <TD className="tabular-nums">{p.services}</TD>
                <TD className="tabular-nums">{p.revenue}</TD>
                <TD className="tabular-nums">★ {p.rating}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
