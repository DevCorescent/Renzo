// OWNER: Hemant | MODULE: Billing List
import Link from "next/link";
import { IndianRupee, Clock, CheckCircle2 } from "lucide-react";
import { PageHeader, StatCard, Card, CardHeader, CardTitle, Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";

const invoices = [
  { id: "INV-2041", customer: "Karan Malhotra", items: 1, amount: "₹950", status: "Unpaid", tone: "warning" as const },
  { id: "INV-2040", customer: "Sneha Kapoor", items: 2, amount: "₹6,300", status: "Unpaid", tone: "warning" as const },
  { id: "INV-2039", customer: "Farah Ali", items: 3, amount: "₹2,300", status: "Partial", tone: "info" as const },
  { id: "INV-2038", customer: "Nisha Patel", items: 1, amount: "₹4,000", status: "Paid", tone: "success" as const },
  { id: "INV-2037", customer: "Divya Menon", items: 2, amount: "₹1,800", status: "Paid", tone: "success" as const },
];

export default function BillingListPage() {
  return (
    <>
      <PageHeader eyebrow="Front Desk" title="Billing" subtitle="Invoices generated from today's appointments." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Unpaid" value="₹7,250" hint="2 invoices" icon={Clock} />
        <StatCard label="Collected Today" value="₹32,450" delta={{ value: "8%", positive: true }} icon={IndianRupee} />
        <StatCard label="Invoices Settled" value="14" hint="today" icon={CheckCircle2} />
      </div>

      <Card>
        <CardHeader><CardTitle>All Invoices</CardTitle></CardHeader>
        <Table>
          <THead>
            <tr><TH>Invoice</TH><TH>Customer</TH><TH>Items</TH><TH>Amount</TH><TH>Status</TH><TH className="text-right">Action</TH></tr>
          </THead>
          <tbody>
            {invoices.map((v) => (
              <TR key={v.id}>
                <TD className="font-medium">{v.id}</TD>
                <TD>{v.customer}</TD>
                <TD className="tabular-nums text-muted-foreground">{v.items}</TD>
                <TD className="font-semibold tabular-nums">{v.amount}</TD>
                <TD><Badge tone={v.tone}>{v.status}</Badge></TD>
                <TD className="text-right">
                  <Link href={`/reception/billing/${v.id}`} className="text-xs font-semibold uppercase tracking-wider text-primary hover:underline">
                    {v.status === "Paid" ? "View" : "Collect"}
                  </Link>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
