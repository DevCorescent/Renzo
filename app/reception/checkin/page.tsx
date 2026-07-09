// OWNER: Hemant | MODULE: Customer Check-in
import { Search, UserCheck } from "lucide-react";
import { PageHeader, Card, CardHeader, CardTitle, Badge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const matches = [
  { time: "10:45", customer: "Ritika Sharma", phone: "•••• 43210", worker: "Priya N.", service: "Haircut & Style", state: "arrive" },
  { time: "11:30", customer: "Meera Iyer", phone: "•••• 88190", worker: "Zoya K.", service: "Keratin Treatment", state: "arrive" },
  { time: "10:15", customer: "Karan Malhotra", phone: "•••• 20654", worker: "Arjun S.", service: "Haircut", state: "in" },
];

export default function CheckinPage() {
  return (
    <>
      <PageHeader eyebrow="Front Desk" title="Check-in" subtitle="Find a booking and mark the customer as arrived." />

      <Card>
        <div className="p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input autoFocus placeholder="Scan or search phone / name / booking ID…" className="w-full border border-input bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none focus:border-ring" />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Today's Bookings</CardTitle></CardHeader>
        <div className="p-0">
          {matches.map((m, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border/70 px-5 py-4 last:border-0">
              <span className="font-heading text-lg font-semibold tabular-nums">{m.time}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.customer} <span className="ml-1 text-xs font-normal text-muted-foreground">{m.phone}</span></p>
                <p className="truncate text-sm text-muted-foreground">{m.service} · {m.worker}</p>
              </div>
              {m.state === "in" ? (
                <Badge tone="success">Checked in</Badge>
              ) : (
                <Button size="sm"><UserCheck /> Check in</Button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
