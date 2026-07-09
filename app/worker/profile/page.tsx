// OWNER: Hemant | MODULE: Worker Profile
import { PageHeader, Card, CardHeader, CardTitle, CardBody, Badge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const skills = ["Balayage", "Keratin", "Bridal Styling", "Colour Correction", "Men's Grooming"];
const services = [
  { name: "Haircut & Style", price: "₹800" },
  { name: "Balayage", price: "₹4,500" },
  { name: "Keratin Treatment", price: "₹6,000" },
  { name: "Root Touch-up", price: "₹1,500" },
];

export default function WorkerProfilePage() {
  return (
    <>
      <PageHeader eyebrow="My Account" title="Profile" actions={<Button variant="outline">Edit</Button>} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardBody className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-24 items-center justify-center bg-gradient-to-br from-stone-300 to-stone-500 font-heading text-3xl font-semibold text-white">
              PN
            </div>
            <div>
              <p className="font-heading text-xl font-semibold">Priya Nair</p>
              <p className="text-sm text-muted-foreground">Senior Stylist · Bandra</p>
            </div>
            <div className="flex gap-2">
              <Badge tone="primary">EMP-0342</Badge>
              <Badge tone="success">Active</Badge>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Details</CardTitle></CardHeader>
            <CardBody className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Field label="Email" value="priya.nair@renzo.in" />
              <Field label="Phone" value="+91 98765 43210" />
              <Field label="Department" value="Hair" />
              <Field label="Designation" value="Senior Stylist" />
              <Field label="Joined" value="14 Mar 2023" />
              <Field label="Reporting to" value="Rohit Menon" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Skills</CardTitle></CardHeader>
            <CardBody className="flex flex-wrap gap-2">
              {skills.map((s) => <Badge key={s} tone="neutral">{s}</Badge>)}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Services Offered</CardTitle></CardHeader>
            <CardBody className="p-0">
              {services.map((s, i) => (
                <div key={i} className="flex items-center justify-between border-b border-border/70 px-5 py-3 last:border-0">
                  <span className="text-sm">{s.name}</span>
                  <span className="text-sm font-semibold tabular-nums">{s.price}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
