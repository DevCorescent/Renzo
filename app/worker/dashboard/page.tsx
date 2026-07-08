// OWNER: Hemant | MODULE: Worker Dashboard
import Link from "next/link";
import { CalendarCheck, Clock, Star, IndianRupee, Play } from "lucide-react";
import { HeroBanner, StatCard, Card, CardHeader, CardTitle, CardBody, Badge, DemoNote } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const today = [
  { time: "10:00", customer: "Sneha Kapoor", service: "Balayage + Gloss", status: "In progress", tone: "info" as const },
  { time: "11:30", customer: "Ritika Sharma", service: "Haircut & Style", status: "Upcoming", tone: "neutral" as const },
  { time: "13:00", customer: "Meera Iyer", service: "Keratin Treatment", status: "Upcoming", tone: "neutral" as const },
  { time: "15:30", customer: "Divya Menon", service: "Root Touch-up", status: "Upcoming", tone: "neutral" as const },
];

export default function WorkerDashboardPage() {
  return (
    <>
      <HeroBanner
        eyebrow="Tuesday · 8 Jul 2026"
        title="Good morning,"
        highlight="Priya"
        subtitle="You have 4 appointments today and one pending reschedule request."
        actions={<Button><Play /> Start next service</Button>}
        stats={[
          { label: "Today", value: "4" },
          { label: "Rating", value: "4.9" },
          { label: "MTD", value: "₹18.2K" },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today's Bookings" value="4" hint="1 in progress" icon={CalendarCheck} />
        <StatCard label="Clocked In" value="09:42" hint="On time" icon={Clock} />
        <StatCard label="Avg Rating" value="4.9" delta={{ value: "0.1", positive: true }} hint="this month" icon={Star} />
        <StatCard label="Commission MTD" value="₹18,240" delta={{ value: "12%", positive: true }} icon={IndianRupee} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Today's Schedule</CardTitle>
            <Link href="/worker/bookings" className="text-xs font-medium text-primary hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            {today.map((a, i) => (
              <Link
                key={i}
                href="/worker/bookings/apt_1042"
                className="flex items-center gap-4 border-b border-border/70 px-5 py-4 last:border-0 hover:bg-muted/40"
              >
                <span className="font-heading text-lg font-semibold tabular-nums">{a.time}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.customer}</p>
                  <p className="truncate text-sm text-muted-foreground">{a.service}</p>
                </div>
                <Badge tone={a.tone}>{a.status}</Badge>
              </Link>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>This Week</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <Row label="Services done" value="27" />
            <Row label="Hours worked" value="38.5" />
            <Row label="Rebook rate" value="64%" />
            <Row label="Products sold" value="₹6,900" />
            <div className="border-t border-border pt-4">
              <DemoNote>Hardcoded preview · Phase 2 wires live data</DemoNote>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
