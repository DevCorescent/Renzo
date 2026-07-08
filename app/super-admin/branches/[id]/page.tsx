// OWNER: Hemant | MODULE: Branch Detail & Settings
import Link from "next/link";
import { ArrowLeft, MapPin, Phone, Clock } from "lucide-react";
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardBody, Badge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const timings = [
  { day: "Monday", hours: "10:00 – 21:00" },
  { day: "Tuesday", hours: "10:00 – 21:00" },
  { day: "Wednesday", hours: "10:00 – 21:00" },
  { day: "Thursday", hours: "10:00 – 21:00" },
  { day: "Friday", hours: "10:00 – 22:00" },
  { day: "Saturday", hours: "09:00 – 22:00" },
  { day: "Sunday", hours: "09:00 – 20:00" },
];

export default async function SuperAdminBranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Link href="/super-admin/branches" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to branches
      </Link>

      <PageHeader eyebrow={`Branch · ${id.toUpperCase()}`} title="Renzo Bandra" subtitle="Mumbai · Manager: Rohit Menon"
        actions={<><Button variant="outline" size="sm">Holidays</Button><Button size="sm">Edit branch</Button></>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Revenue MTD" value="₹12.6L" delta={{ value: "14%", positive: true }} />
        <StatCard label="Staff" value="10" hint="8 present" />
        <StatCard label="Bookings" value="742" hint="this month" />
        <StatCard label="Rating" value="4.8" delta={{ value: "0.2", positive: true }} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Operating Hours</CardTitle></CardHeader>
          <CardBody className="p-0">
            {timings.map((t) => (
              <div key={t.day} className="flex items-center justify-between border-b border-border/70 px-5 py-3 last:border-0">
                <span className="text-sm">{t.day}</span>
                <span className="text-sm font-medium tabular-nums">{t.hours}</span>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardBody className="space-y-4 text-sm">
            <div className="flex items-start gap-2.5"><MapPin className="mt-0.5 size-4 text-muted-foreground" /><span>Hill Road, Bandra West, Mumbai 400050</span></div>
            <div className="flex items-center gap-2.5"><Phone className="size-4 text-muted-foreground" /><span>+91 22 4000 1234</span></div>
            <div className="flex items-center gap-2.5"><Clock className="size-4 text-muted-foreground" /><span>Opened 14 Mar 2021</span></div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge tone="success">Active</Badge>
              <Badge tone="primary">Flagship</Badge>
              <Badge tone="info">Online booking on</Badge>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
