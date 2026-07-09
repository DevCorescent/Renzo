// OWNER: Hemant | MODULE: Branch Admin Dashboard
import Link from "next/link";
import { IndianRupee, CalendarDays, Users, AlertTriangle, Star } from "lucide-react";
import { HeroBanner, StatCard, Card, CardHeader, CardTitle, CardBody, Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";

const hourly = [
  { h: "9a", v: 20 }, { h: "10a", v: 55 }, { h: "11a", v: 80 }, { h: "12p", v: 65 },
  { h: "1p", v: 40 }, { h: "2p", v: 50 }, { h: "3p", v: 72 }, { h: "4p", v: 90 },
  { h: "5p", v: 78 }, { h: "6p", v: 60 },
];

const staff = [
  { name: "Priya Nair", role: "Senior Stylist", status: "Present", tone: "success" as const, busy: "In service" },
  { name: "Arjun Singh", role: "Stylist", status: "Present", tone: "success" as const, busy: "Free" },
  { name: "Zoya Khan", role: "Beautician", status: "Present", tone: "success" as const, busy: "In service" },
  { name: "Rahul Verma", role: "Stylist", status: "On leave", tone: "warning" as const, busy: "—" },
];

const alerts = [
  { text: "Argan Serum below reorder level (4 left)", tone: "warning" as const },
  { text: "3 reviews awaiting moderation", tone: "info" as const },
  { text: "Rahul Verma leave approved for today", tone: "neutral" as const },
];

export default function BranchAdminDashboardPage() {
  return (
    <>
      <HeroBanner
        eyebrow="Bandra Branch · 8 Jul 2026"
        title="Branch"
        highlight="Overview"
        subtitle="Live performance across your team today."
        stats={[
          { label: "Revenue", value: "₹64.2K" },
          { label: "Bookings", value: "34" },
          { label: "Rating", value: "4.8" },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue Today" value="₹64,200" delta={{ value: "12%", positive: true }} icon={IndianRupee} />
        <StatCard label="Bookings" value="34" hint="6 walk-ins" icon={CalendarDays} />
        <StatCard label="Staff Present" value="8/10" hint="2 on leave" icon={Users} />
        <StatCard label="Avg Rating" value="4.8" delta={{ value: "0.2", positive: true }} icon={Star} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Bookings by Hour</CardTitle><span className="text-xs text-muted-foreground">Today</span></CardHeader>
          <CardBody>
            <div className="flex h-48 items-end gap-2">
              {hourly.map((b) => (
                <div key={b.h} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex w-full items-end" style={{ height: "100%" }}>
                    <div className="w-full bg-primary/80 transition-all hover:bg-primary" style={{ height: `${b.v}%` }} />
                  </div>
                  <span className="text-[0.65rem] text-muted-foreground">{b.h}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Alerts</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            {alerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <p className="text-sm">{a.text}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff on Floor</CardTitle>
          <Link href="/branch-admin/workers" className="text-xs font-medium text-primary hover:underline">Manage →</Link>
        </CardHeader>
        <Table>
          <THead><tr><TH>Name</TH><TH>Role</TH><TH>Attendance</TH><TH>Status</TH></tr></THead>
          <tbody>
            {staff.map((s, i) => (
              <TR key={i}>
                <TD className="font-medium">{s.name}</TD>
                <TD className="text-muted-foreground">{s.role}</TD>
                <TD><Badge tone={s.tone}>{s.status}</Badge></TD>
                <TD className="text-muted-foreground">{s.busy}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
