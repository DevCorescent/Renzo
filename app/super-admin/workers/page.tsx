// OWNER: Hemant | MODULE: All Workers Management
import Link from "next/link";
import { UserPlus, Search } from "lucide-react";
import { PageHeader, Card, CardHeader, CardTitle, Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const workers = [
  { id: "wrk_1", name: "Priya Nair", branch: "Bandra", role: "Senior Stylist", rating: "4.9", status: "Active", tone: "success" as const },
  { id: "wrk_2", name: "Arjun Singh", branch: "Bandra", role: "Stylist", rating: "4.7", status: "Active", tone: "success" as const },
  { id: "wrk_6", name: "Sana Sheikh", branch: "Koramangala", role: "Senior Stylist", rating: "4.8", status: "Active", tone: "success" as const },
  { id: "wrk_7", name: "Vikram Rao", branch: "Banjara Hills", role: "Barber", rating: "4.6", status: "Active", tone: "success" as const },
  { id: "wrk_8", name: "Deepa Nair", branch: "CP", role: "Beautician", rating: "4.9", status: "On leave", tone: "warning" as const },
  { id: "wrk_9", name: "Imran Qureshi", branch: "Koramangala", role: "Stylist", rating: "4.5", status: "Suspended", tone: "danger" as const },
];

export default function SuperAdminWorkersPage() {
  return (
    <>
      <PageHeader eyebrow="Platform" title="Workers" subtitle="118 staff across all branches."
        actions={<Button size="sm"><UserPlus /> Add worker</Button>} />

      <Card>
        <CardHeader>
          <CardTitle>All Staff</CardTitle>
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input placeholder="Search…" className="w-48 border border-input bg-transparent py-1.5 pl-8 pr-3 text-xs outline-none focus:border-ring" />
          </div>
        </CardHeader>
        <Table>
          <THead><tr><TH>Name</TH><TH>Branch</TH><TH>Role</TH><TH>Rating</TH><TH>Status</TH><TH className="text-right">—</TH></tr></THead>
          <tbody>
            {workers.map((w) => (
              <TR key={w.id}>
                <TD className="font-medium">{w.name}</TD>
                <TD className="text-muted-foreground">{w.branch}</TD>
                <TD className="text-muted-foreground">{w.role}</TD>
                <TD className="tabular-nums">★ {w.rating}</TD>
                <TD><Badge tone={w.tone}>{w.status}</Badge></TD>
                <TD className="text-right">
                  <Link href={`/super-admin/workers/${w.id}`} className="text-xs font-semibold uppercase tracking-wider text-primary hover:underline">View</Link>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
