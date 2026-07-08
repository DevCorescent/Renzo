// OWNER: Hemant | MODULE: New Booking — walk-in / call
import { Search, Clock } from "lucide-react";
import { PageHeader, Card, CardHeader, CardTitle, CardBody, Badge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const slots = ["10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "14:00", "14:30", "15:00"];
const services = [
  { name: "Haircut & Style", dur: "45m", price: "₹800" },
  { name: "Balayage", dur: "120m", price: "₹4,500" },
  { name: "Keratin Treatment", dur: "150m", price: "₹6,000" },
  { name: "Root Touch-up", dur: "60m", price: "₹1,500" },
];

export default function NewBookingPage() {
  return (
    <>
      <PageHeader eyebrow="Front Desk" title="New Booking" subtitle="Create a walk-in or phone booking." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>1 · Customer</CardTitle></CardHeader>
            <CardBody className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input placeholder="Search by phone or name…" className="w-full border border-input bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-ring" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Full name" placeholder="e.g. Anaya Verma" />
                <Input label="Phone" placeholder="+91 …" />
              </div>
              <Badge tone="info">New customer will be created</Badge>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>2 · Services</CardTitle></CardHeader>
            <CardBody className="p-0">
              {services.map((s, i) => (
                <label key={i} className="flex cursor-pointer items-center gap-3 border-b border-border/70 px-5 py-3 last:border-0 hover:bg-muted/40">
                  <input type="checkbox" defaultChecked={i === 0} className="size-4 accent-primary" />
                  <span className="flex-1 text-sm font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{s.dur}</span>
                  <span className="w-16 text-right text-sm font-semibold tabular-nums">{s.price}</span>
                </label>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>3 · Stylist & Time</CardTitle></CardHeader>
            <CardBody className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Stylist</span>
                <select className="w-full border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring">
                  <option>Any available</option><option>Priya Nair</option><option>Arjun Singh</option><option>Zoya Khan</option>
                </select>
              </label>
              <div>
                <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Clock className="size-3.5" /> Available slots</span>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {slots.map((t, i) => (
                    <button key={t} className={i === 1 ? "border border-primary bg-primary/10 py-2 text-sm font-semibold text-primary" : "border border-border py-2 text-sm hover:bg-muted"}>{t}</button>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div>
          <Card className="sticky top-24">
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardBody className="space-y-3 text-sm">
              <Row label="Customer" value="Anaya Verma" />
              <Row label="Service" value="Haircut & Style" />
              <Row label="Stylist" value="Priya Nair" />
              <Row label="Time" value="Today · 10:30" />
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Total</span>
                <span className="font-heading text-xl font-semibold tabular-nums">₹800</span>
              </div>
              <Button className="w-full justify-center">Confirm booking</Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

function Input({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input placeholder={placeholder} className="w-full border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring" />
    </label>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
