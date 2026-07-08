// OWNER: Hemant | MODULE: Reports & Analytics Dashboard
import { IndianRupee, TrendingUp, Users, Repeat } from "lucide-react";
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardBody, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const months = [
  { m: "Feb", v: 58 }, { m: "Mar", v: 64 }, { m: "Apr", v: 61 }, { m: "May", v: 75 },
  { m: "Jun", v: 82 }, { m: "Jul", v: 100 },
];

const branchRows = [
  { name: "Bandra", revenue: "₹12.6L", bookings: 742, growth: "+14%", pos: true },
  { name: "Koramangala", revenue: "₹10.9L", bookings: 690, growth: "+9%", pos: true },
  { name: "CP", revenue: "₹9.7L", bookings: 604, growth: "+2%", pos: true },
  { name: "Banjara Hills", revenue: "₹8.4L", bookings: 512, growth: "-3%", pos: false },
];

export default function SuperAdminReportsPage() {
  return (
    <>
      <PageHeader eyebrow="Analytics" title="Reports" subtitle="Platform-wide performance and trends."
        actions={<><Button variant="outline" size="sm">Last 6 months</Button><Button size="sm">Export</Button></>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue YTD" value="₹2.4Cr" delta={{ value: "18%", positive: true }} icon={IndianRupee} />
        <StatCard label="Bookings YTD" value="16,204" delta={{ value: "11%", positive: true }} icon={TrendingUp} />
        <StatCard label="New Customers" value="3,110" delta={{ value: "8%", positive: true }} icon={Users} />
        <StatCard label="Retention" value="61%" delta={{ value: "2%", positive: true }} icon={Repeat} />
      </div>

      <Card>
        <CardHeader><CardTitle>Revenue Trend</CardTitle><span className="text-xs text-muted-foreground">All branches</span></CardHeader>
        <CardBody>
          <div className="flex h-56 items-end gap-4">
            {months.map((b) => (
              <div key={b.m} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full flex-1 items-end">
                  <div className="w-full bg-primary/80 hover:bg-primary" style={{ height: `${b.v}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">{b.m}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Branch Leaderboard</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Branch</TH><TH>Revenue MTD</TH><TH>Bookings</TH><TH>MoM Growth</TH></tr></THead>
          <tbody>
            {branchRows.map((r) => (
              <TR key={r.name}>
                <TD className="font-medium">{r.name}</TD>
                <TD className="tabular-nums">{r.revenue}</TD>
                <TD className="tabular-nums">{r.bookings}</TD>
                <TD className={`tabular-nums font-medium ${r.pos ? "text-emerald-600 dark:text-emerald-500" : "text-destructive"}`}>{r.growth}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
