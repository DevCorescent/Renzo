// OWNER: Hemant | MODULE: Customer Detail & Timeline
import Link from "next/link";
import { ArrowLeft, Scissors, Receipt, Star, Gift } from "lucide-react";
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardBody, Badge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const timeline = [
  { icon: Scissors, title: "Balayage + Gloss", meta: "Priya N. · Bandra", when: "Today", amount: "₹6,300" },
  { icon: Star, title: "Left a 5★ review", meta: "“Best balayage in years”", when: "Today", amount: "" },
  { icon: Receipt, title: "Invoice INV-2040 paid", meta: "UPI", when: "Today", amount: "₹6,300" },
  { icon: Gift, title: "Redeemed 500 loyalty points", meta: "₹250 off", when: "2 weeks ago", amount: "" },
  { icon: Scissors, title: "Root Touch-up", meta: "Priya N. · Bandra", when: "3 weeks ago", amount: "₹1,500" },
];

export default async function SuperAdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Link href="/super-admin/customers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to customers
      </Link>

      <PageHeader eyebrow={`Customer · ${id.toUpperCase()}`} title="Sneha Kapoor" subtitle="Member since Jan 2024 · Bandra"
        actions={<><Button variant="outline" size="sm">Add note</Button><Button size="sm">New booking</Button></>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tier" value="Gold" hint="20% off services" />
        <StatCard label="Lifetime Spend" value="₹86,400" />
        <StatCard label="Visits" value="14" hint="last 12 mo" />
        <StatCard label="Loyalty Points" value="2,340" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardBody className="space-y-3 text-sm">
            <Field label="Phone" value="+91 98••• ••210" />
            <Field label="Email" value="sneha.k@email.com" />
            <Field label="Birthday" value="14 Aug" />
            <Field label="Preferred stylist" value="Priya Nair" />
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge tone="warning">Gold Member</Badge>
              <Badge tone="info">Prefers ash tones</Badge>
              <Badge tone="danger">Ammonia allergy</Badge>
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Activity Timeline</CardTitle></CardHeader>
          <CardBody className="space-y-0">
            {timeline.map((t, i) => (
              <div key={i} className="flex gap-4 border-b border-border/70 py-3.5 last:border-0">
                <div className="flex size-8 shrink-0 items-center justify-center bg-muted"><t.icon className="size-4 text-muted-foreground" /></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.meta}</p>
                </div>
                <div className="text-right">
                  {t.amount && <p className="text-sm font-semibold tabular-nums">{t.amount}</p>}
                  <p className="text-xs text-muted-foreground">{t.when}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
