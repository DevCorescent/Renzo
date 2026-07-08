// OWNER: Hemant | MODULE: Worker Attendance — clock in/out, log, monthly calendar
import { Clock, LogIn, LogOut } from "lucide-react";
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardBody, Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const log = [
  { date: "8 Jul", in: "09:42", out: "—", hrs: "—", status: "Present", tone: "info" as const },
  { date: "7 Jul", in: "09:55", out: "18:30", hrs: "8.5", status: "Present", tone: "success" as const },
  { date: "6 Jul", in: "10:12", out: "18:40", hrs: "8.4", status: "Late", tone: "warning" as const },
  { date: "5 Jul", in: "—", out: "—", hrs: "—", status: "Week off", tone: "neutral" as const },
  { date: "4 Jul", in: "09:38", out: "18:15", hrs: "8.6", status: "Present", tone: "success" as const },
];

// 0 = off, 1 = present, 2 = late, 3 = leave
const month = [1, 1, 2, 1, 1, 0, 0, 1, 1, 1, 2, 1, 0, 0, 1, 3, 1, 1, 1, 0, 0, 1, 1, 2, 1, 1, 0, 0, 1, 1];
const dayTone = ["bg-muted", "bg-emerald-500/70", "bg-amber-500/70", "bg-sky-500/70"];

export default function WorkerAttendancePage() {
  return (
    <>
      <PageHeader
        eyebrow="July 2026"
        title="Attendance"
        subtitle="Clocked in at 09:42 today."
        actions={<Button><LogOut /> Clock out</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Status Today" value="Clocked In" hint="since 09:42" icon={LogIn} />
        <StatCard label="Hours Today" value="6.3" hint="running" icon={Clock} />
        <StatCard label="Present Days" value="22/24" hint="this month" />
        <StatCard label="Late Marks" value="3" hint="this month" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent Log</CardTitle></CardHeader>
          <Table>
            <THead>
              <tr><TH>Date</TH><TH>In</TH><TH>Out</TH><TH>Hours</TH><TH>Status</TH></tr>
            </THead>
            <tbody>
              {log.map((r) => (
                <TR key={r.date}>
                  <TD className="font-medium">{r.date}</TD>
                  <TD className="tabular-nums">{r.in}</TD>
                  <TD className="tabular-nums">{r.out}</TD>
                  <TD className="tabular-nums">{r.hrs}</TD>
                  <TD><Badge tone={r.tone}>{r.status}</Badge></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader><CardTitle>July Overview</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-7 gap-1.5">
              {month.map((d, i) => (
                <div
                  key={i}
                  title={`Jul ${i + 1}`}
                  className={`flex aspect-square items-center justify-center text-[0.6rem] font-medium text-foreground/70 ${dayTone[d]}`}
                >
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <Legend cls="bg-emerald-500/70" label="Present" />
              <Legend cls="bg-amber-500/70" label="Late" />
              <Legend cls="bg-sky-500/70" label="Leave" />
              <Legend cls="bg-muted" label="Off" />
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-3 ${cls}`} /> {label}
    </span>
  );
}
