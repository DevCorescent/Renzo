// OWNER: Hemant | MODULE: Audit Logs
import { Search, ShieldCheck } from "lucide-react";
import { PageHeader, Card, CardHeader, CardTitle, Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";

const logs = [
  { time: "12:04:22", actor: "Kabir Shah", role: "Super Admin", action: "Updated branch settings", target: "Renzo Bandra", tone: "info" as const },
  { time: "11:58:10", actor: "Rohit Menon", role: "Branch Admin", action: "Approved review", target: "REV-8821", tone: "success" as const },
  { time: "11:42:03", actor: "System", role: "Cron", action: "Sent WhatsApp reminders", target: "84 recipients", tone: "neutral" as const },
  { time: "11:20:47", actor: "Anita Rao", role: "Receptionist", action: "Issued refund", target: "INV-2033 · ₹1,200", tone: "warning" as const },
  { time: "10:55:19", actor: "Kabir Shah", role: "Super Admin", action: "Suspended worker", target: "Imran Qureshi", tone: "danger" as const },
  { time: "10:31:02", actor: "Shalmon (API)", role: "Auth", action: "Failed login attempt", target: "203.0.113.42", tone: "danger" as const },
  { time: "09:48:55", actor: "Rohit Menon", role: "Branch Admin", action: "Published shift roster", target: "Week 28 · Bandra", tone: "info" as const },
];

export default function SuperAdminAuditLogsPage() {
  return (
    <>
      <PageHeader eyebrow="Security" title="Audit Logs" subtitle="Immutable record of sensitive actions across the platform." />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" /> Activity</CardTitle>
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input placeholder="Filter by actor or action…" className="w-64 border border-input bg-transparent py-1.5 pl-8 pr-3 text-xs outline-none focus:border-ring" />
          </div>
        </CardHeader>
        <Table>
          <THead><tr><TH>Time</TH><TH>Actor</TH><TH>Role</TH><TH>Action</TH><TH>Target</TH></tr></THead>
          <tbody>
            {logs.map((l, i) => (
              <TR key={i}>
                <TD className="font-mono text-xs text-muted-foreground tabular-nums">{l.time}</TD>
                <TD className="font-medium">{l.actor}</TD>
                <TD className="text-muted-foreground">{l.role}</TD>
                <TD><Badge tone={l.tone}>{l.action}</Badge></TD>
                <TD className="text-muted-foreground">{l.target}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
