// OWNER: Hemant | MODULE: Branch Workers List — shifts + leave status
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { PageHeader, Card, CardHeader, CardTitle, Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const workers = [
  { id: "wrk_1", name: "Priya Nair", role: "Senior Stylist", shift: "10:00 – 19:00", rating: "4.9", status: "Present", tone: "success" as const },
  { id: "wrk_2", name: "Arjun Singh", role: "Stylist", shift: "10:00 – 19:00", rating: "4.7", status: "Present", tone: "success" as const },
  { id: "wrk_3", name: "Zoya Khan", role: "Beautician", shift: "11:00 – 20:00", rating: "4.8", status: "Present", tone: "success" as const },
  { id: "wrk_4", name: "Rahul Verma", role: "Stylist", shift: "—", rating: "4.6", status: "On leave", tone: "warning" as const },
  { id: "wrk_5", name: "Neha Gupta", role: "Nail Artist", shift: "12:00 – 21:00", rating: "4.9", status: "Present", tone: "success" as const },
];

export default function BranchWorkersPage() {
  return (
    <>
      <PageHeader eyebrow="Bandra Branch" title="Workers" subtitle="10 staff · 8 present today"
        actions={<Button size="sm"><UserPlus /> Add worker</Button>} />

      <Card>
        <CardHeader><CardTitle>Team</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Name</TH><TH>Role</TH><TH>Today's Shift</TH><TH>Rating</TH><TH>Status</TH><TH className="text-right">—</TH></tr></THead>
          <tbody>
            {workers.map((w) => (
              <TR key={w.id}>
                <TD>
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center bg-primary text-[0.6rem] font-semibold uppercase text-primary-foreground">{w.name.split(" ").map(n=>n[0]).join("")}</div>
                    <span className="font-medium">{w.name}</span>
                  </div>
                </TD>
                <TD className="text-muted-foreground">{w.role}</TD>
                <TD className="tabular-nums text-muted-foreground">{w.shift}</TD>
                <TD className="tabular-nums">★ {w.rating}</TD>
                <TD><Badge tone={w.tone}>{w.status}</Badge></TD>
                <TD className="text-right">
                  <Link href={`/branch-admin/workers/${w.id}`} className="text-xs font-semibold uppercase tracking-wider text-primary hover:underline">View</Link>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
