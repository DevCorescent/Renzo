// OWNER: Hemant | MODULE: Branches Management Table
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader, Card, CardHeader, CardTitle, Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const branches = [
  { id: "br_1", name: "Renzo Bandra", city: "Mumbai", staff: 10, revenue: "₹12.6L", status: "Active", tone: "success" as const },
  { id: "br_2", name: "Renzo Koramangala", city: "Bengaluru", staff: 12, revenue: "₹10.9L", status: "Active", tone: "success" as const },
  { id: "br_3", name: "Renzo Banjara Hills", city: "Hyderabad", staff: 8, revenue: "₹8.4L", status: "Active", tone: "success" as const },
  { id: "br_4", name: "Renzo CP", city: "Delhi", staff: 11, revenue: "₹9.7L", status: "Active", tone: "success" as const },
  { id: "br_5", name: "Renzo Powai", city: "Mumbai", staff: 0, revenue: "—", status: "Opening soon", tone: "warning" as const },
];

export default function SuperAdminBranchesPage() {
  return (
    <>
      <PageHeader eyebrow="Platform" title="Branches" subtitle="5 locations across 4 cities."
        actions={<Button size="sm"><Plus /> Add branch</Button>} />

      <Card>
        <CardHeader><CardTitle>All Branches</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Branch</TH><TH>City</TH><TH>Staff</TH><TH>Revenue MTD</TH><TH>Status</TH><TH className="text-right">—</TH></tr></THead>
          <tbody>
            {branches.map((b) => (
              <TR key={b.id}>
                <TD className="font-medium">{b.name}</TD>
                <TD className="text-muted-foreground">{b.city}</TD>
                <TD className="tabular-nums">{b.staff}</TD>
                <TD className="tabular-nums">{b.revenue}</TD>
                <TD><Badge tone={b.tone}>{b.status}</Badge></TD>
                <TD className="text-right">
                  <Link href={`/super-admin/branches/${b.id}`} className="text-xs font-semibold uppercase tracking-wider text-primary hover:underline">Manage</Link>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
