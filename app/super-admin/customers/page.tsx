// OWNER: Hemant | MODULE: Customer CRM Table
import Link from "next/link";
import { Search, Users, Star, IndianRupee } from "lucide-react";
import { PageHeader, StatCard, Card, CardHeader, CardTitle, Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";

const customers = [
  { id: "cus_1", name: "Sneha Kapoor", phone: "•••• 43210", tier: "Gold", tone: "warning" as const, visits: 14, spend: "₹86,400", last: "Today" },
  { id: "cus_2", name: "Karan Malhotra", phone: "•••• 20654", tier: "Silver", tone: "neutral" as const, visits: 6, spend: "₹22,100", last: "Today" },
  { id: "cus_3", name: "Meera Iyer", phone: "•••• 88190", tier: "Platinum", tone: "primary" as const, visits: 31, spend: "₹2,14,000", last: "2d ago" },
  { id: "cus_4", name: "Farah Ali", phone: "•••• 55021", tier: "Silver", tone: "neutral" as const, visits: 9, spend: "₹34,500", last: "5d ago" },
  { id: "cus_5", name: "Nisha Patel", phone: "•••• 71234", tier: "Gold", tone: "warning" as const, visits: 18, spend: "₹98,700", last: "1w ago" },
];

export default function SuperAdminCustomersPage() {
  return (
    <>
      <PageHeader eyebrow="CRM" title="Customers" subtitle="9,120 customers across all branches." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Customers" value="9,120" delta={{ value: "4%", positive: true }} icon={Users} />
        <StatCard label="Members" value="1,340" hint="15% of base" icon={Star} />
        <StatCard label="Avg Lifetime Value" value="₹18,600" delta={{ value: "6%", positive: true }} icon={IndianRupee} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input placeholder="Search name or phone…" className="w-56 border border-input bg-transparent py-1.5 pl-8 pr-3 text-xs outline-none focus:border-ring" />
          </div>
        </CardHeader>
        <Table>
          <THead><tr><TH>Customer</TH><TH>Phone</TH><TH>Tier</TH><TH>Visits</TH><TH>Lifetime Spend</TH><TH>Last Visit</TH></tr></THead>
          <tbody>
            {customers.map((c) => (
              <TR key={c.id}>
                <TD>
                  <Link href={`/super-admin/customers/${c.id}`} className="font-medium text-primary hover:underline">{c.name}</Link>
                </TD>
                <TD className="text-muted-foreground tabular-nums">{c.phone}</TD>
                <TD><Badge tone={c.tone}>{c.tier}</Badge></TD>
                <TD className="tabular-nums">{c.visits}</TD>
                <TD className="font-semibold tabular-nums">{c.spend}</TD>
                <TD className="text-muted-foreground">{c.last}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
