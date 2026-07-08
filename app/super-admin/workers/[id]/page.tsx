// OWNER: Hemant | MODULE: Worker Detail (platform view)
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardBody, Badge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

export default async function SuperAdminWorkerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Link href="/super-admin/workers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to workers
      </Link>

      <PageHeader eyebrow={`Employee · ${id.toUpperCase()}`} title="Priya Nair" subtitle="Senior Stylist · Bandra · Joined Mar 2023"
        actions={<><Button variant="outline" size="sm">Transfer branch</Button><Button variant="destructive" size="sm">Suspend</Button></>} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Lifetime Revenue" value="₹28.4L" hint="since 2023" />
        <StatCard label="Services Done" value="3,912" />
        <StatCard label="Avg Rating" value="4.9" delta={{ value: "0.1", positive: true }} />
        <StatCard label="Commission Paid" value="₹4.2L" hint="lifetime" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Employment</CardTitle></CardHeader>
          <CardBody className="space-y-3 text-sm">
            <Field label="Employee ID" value="EMP-0342" />
            <Field label="Department" value="Hair" />
            <Field label="Designation" value="Senior Stylist" />
            <Field label="Branch" value="Renzo Bandra" />
            <Field label="Commission plan" value="12% on services" />
            <div className="flex gap-2 pt-1"><Badge tone="success">Active</Badge><Badge tone="primary">Top performer</Badge></div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Skills</CardTitle></CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            {["Balayage", "Keratin", "Bridal Styling", "Colour Correction", "Men's Grooming", "Global Colour", "Highlights", "Smoothening"].map((s) => (
              <Badge key={s} tone="neutral">{s}</Badge>
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
