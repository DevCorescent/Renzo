// OWNER: Hemant | MODULE: Branch Worker Detail
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardBody, Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const recent = [
  { date: "8 Jul", customer: "Sneha Kapoor", service: "Balayage", amount: "₹4,500", rating: "5.0" },
  { date: "7 Jul", customer: "Nisha Patel", service: "Global Colour", amount: "₹4,000", rating: "4.8" },
  { date: "7 Jul", customer: "Farah Ali", service: "Haircut", amount: "₹800", rating: "5.0" },
  { date: "6 Jul", customer: "Divya Menon", service: "Root Touch-up", amount: "₹1,500", rating: "4.6" },
];

export default async function BranchWorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Link href="/branch-admin/workers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to workers
      </Link>

      <PageHeader
        eyebrow={`Employee · ${id.toUpperCase()}`}
        title="Priya Nair"
        subtitle="Senior Stylist · Hair Department · Joined Mar 2023"
        actions={<><Button variant="outline" size="sm">Edit shift</Button><Button size="sm">Assign services</Button></>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Rating" value="4.9" delta={{ value: "0.1", positive: true }} />
        <StatCard label="Services MTD" value="112" hint="this month" />
        <StatCard label="Revenue MTD" value="₹1.84L" delta={{ value: "9%", positive: true }} />
        <StatCard label="Attendance" value="96%" hint="last 30d" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Skills & Services</CardTitle></CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            {["Balayage", "Keratin", "Bridal Styling", "Colour Correction", "Men's Grooming", "Global Colour"].map((s) => (
              <Badge key={s} tone="neutral">{s}</Badge>
            ))}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Recent Services</CardTitle></CardHeader>
          <Table>
            <THead><tr><TH>Date</TH><TH>Customer</TH><TH>Service</TH><TH>Amount</TH><TH>Rating</TH></tr></THead>
            <tbody>
              {recent.map((r, i) => (
                <TR key={i}>
                  <TD className="text-muted-foreground">{r.date}</TD>
                  <TD className="font-medium">{r.customer}</TD>
                  <TD className="text-muted-foreground">{r.service}</TD>
                  <TD className="tabular-nums">{r.amount}</TD>
                  <TD className="tabular-nums">★ {r.rating}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
