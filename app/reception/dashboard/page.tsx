// OWNER: Hemant | MODULE: Reception Dashboard
import Link from "next/link";
import { CalendarDays, UserCheck, Users, IndianRupee, PlusCircle } from "lucide-react";
import { HeroBanner, StatCard, Card, CardHeader, CardTitle, Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const appts = [
  { time: "10:00", customer: "Sneha Kapoor", worker: "Priya N.", service: "Balayage", status: "In service", tone: "info" as const },
  { time: "10:15", customer: "Karan Malhotra", worker: "Arjun S.", service: "Haircut", status: "Checked in", tone: "primary" as const },
  { time: "10:45", customer: "Ritika Sharma", worker: "Priya N.", service: "Haircut & Style", status: "Waiting", tone: "warning" as const },
  { time: "11:30", customer: "Meera Iyer", worker: "Zoya K.", service: "Keratin", status: "Booked", tone: "neutral" as const },
];

const pending = [
  { inv: "INV-2041", customer: "Karan Malhotra", amount: "₹950" },
  { inv: "INV-2039", customer: "Farah Ali", amount: "₹2,300" },
];

export default function ReceptionDashboardPage() {
  return (
    <>
      <HeroBanner
        eyebrow="Bandra · 8 Jul 2026"
        title="Front"
        highlight="Desk"
        subtitle="18 appointments today · 3 waiting to be seated."
        actions={<Button><PlusCircle /> New booking</Button>}
        stats={[
          { label: "Today", value: "18" },
          { label: "In Queue", value: "3" },
          { label: "Collected", value: "₹32.4K" },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Appointments" value="18" hint="6 done" icon={CalendarDays} />
        <StatCard label="Checked In" value="4" hint="waiting: 3" icon={UserCheck} />
        <StatCard label="In Queue" value="3" hint="avg wait 12m" icon={Users} />
        <StatCard label="Collected Today" value="₹32,450" delta={{ value: "8%", positive: true }} icon={IndianRupee} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Today's Appointments</CardTitle>
            <Link href="/reception/queue" className="text-xs font-medium text-primary hover:underline">Queue →</Link>
          </CardHeader>
          <Table>
            <THead>
              <tr><TH>Time</TH><TH>Customer</TH><TH>Stylist</TH><TH>Service</TH><TH>Status</TH></tr>
            </THead>
            <tbody>
              {appts.map((a, i) => (
                <TR key={i}>
                  <TD className="font-medium tabular-nums">{a.time}</TD>
                  <TD>{a.customer}</TD>
                  <TD className="text-muted-foreground">{a.worker}</TD>
                  <TD className="text-muted-foreground">{a.service}</TD>
                  <TD><Badge tone={a.tone}>{a.status}</Badge></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Payments</CardTitle>
            <Link href="/reception/billing" className="text-xs font-medium text-primary hover:underline">All →</Link>
          </CardHeader>
          <div className="p-0">
            {pending.map((p) => (
              <Link key={p.inv} href={`/reception/billing/${p.inv}`} className="flex items-center justify-between border-b border-border/70 px-5 py-4 last:border-0 hover:bg-muted/40">
                <div>
                  <p className="text-sm font-medium">{p.customer}</p>
                  <p className="text-xs text-muted-foreground">{p.inv}</p>
                </div>
                <span className="font-semibold tabular-nums">{p.amount}</span>
              </Link>
            ))}
            <div className="px-5 py-4">
              <Button variant="outline" className="w-full justify-center" size="sm">Collect payment</Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
