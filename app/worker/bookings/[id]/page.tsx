// OWNER: Hemant | MODULE: Worker Booking Detail — Start / Complete / Reschedule / Notes
import Link from "next/link";
import { ArrowLeft, Play, Check, CalendarClock, Phone } from "lucide-react";
import { PageHeader, Card, CardHeader, CardTitle, CardBody, Badge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

export default async function WorkerBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const services = [
    { name: "Balayage", price: "₹4,500", dur: "90m" },
    { name: "Gloss Treatment", price: "₹1,800", dur: "30m" },
  ];

  return (
    <>
      <Link href="/worker/bookings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to bookings
      </Link>

      <PageHeader
        eyebrow={`Appointment · ${id}`}
        title="Sneha Kapoor"
        subtitle="Today · 10:00 AM — 12:00 PM · Bandra Branch · Chair 3"
        actions={
          <>
            <Button variant="outline" size="sm"><Phone /> Call</Button>
            <Button variant="outline" size="sm"><CalendarClock /> Reschedule</Button>
            <Button size="sm"><Play /> Start service</Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Services</CardTitle>
              <Badge tone="info">In progress</Badge>
            </CardHeader>
            <CardBody className="p-0">
              {services.map((s, i) => (
                <div key={i} className="flex items-center justify-between border-b border-border/70 px-5 py-4 last:border-0">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.dur}</p>
                  </div>
                  <span className="font-semibold tabular-nums">{s.price}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Total</span>
                <span className="font-heading text-xl font-semibold tabular-nums">₹6,300</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Service Notes</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Client prefers ash tones, avoid warmth. Allergic to ammonia — use ammonia-free colour.
                Last visit: full head foils (12 Apr).
              </p>
              <textarea
                rows={3}
                placeholder="Add a note for this appointment…"
                className="w-full resize-none border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring"
              />
              <div className="flex justify-end">
                <Button size="sm" variant="outline">Save note</Button>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Customer</CardTitle></CardHeader>
            <CardBody className="space-y-3 text-sm">
              <Field label="Name" value="Sneha Kapoor" />
              <Field label="Phone" value="+91 98••• ••210" />
              <Field label="Membership" value="Gold · 20% off" />
              <Field label="Visits" value="14 (last 6 mo)" />
              <Field label="Loyalty" value="2,340 pts" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardBody className="flex flex-col gap-2">
              <Button className="w-full justify-center"><Check /> Complete service</Button>
              <Button variant="outline" className="w-full justify-center"><CalendarClock /> Request reschedule</Button>
            </CardBody>
          </Card>
        </div>
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
