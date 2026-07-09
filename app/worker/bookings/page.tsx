// OWNER: Hemant | MODULE: Worker Bookings — Today / Upcoming / Completed
import Link from "next/link";
import { PageHeader, Card, Table, THead, TH, TR, TD, Badge } from "@/components/shared/ui";

const bookings = [
  { id: "apt_1042", time: "Today · 10:00", customer: "Sneha Kapoor", service: "Balayage + Gloss", dur: "120m", status: "In progress", tone: "info" as const },
  { id: "apt_1043", time: "Today · 11:30", customer: "Ritika Sharma", service: "Haircut & Style", dur: "45m", status: "Upcoming", tone: "neutral" as const },
  { id: "apt_1044", time: "Today · 13:00", customer: "Meera Iyer", service: "Keratin Treatment", dur: "150m", status: "Upcoming", tone: "neutral" as const },
  { id: "apt_1045", time: "Today · 15:30", customer: "Divya Menon", service: "Root Touch-up", dur: "60m", status: "Upcoming", tone: "neutral" as const },
  { id: "apt_1039", time: "Tomorrow · 11:00", customer: "Aisha Khan", service: "Bridal Trial", dur: "180m", status: "Confirmed", tone: "primary" as const },
  { id: "apt_1021", time: "Mon · 12:00", customer: "Nisha Patel", service: "Global Colour", dur: "120m", status: "Completed", tone: "success" as const },
  { id: "apt_1018", time: "Mon · 16:00", customer: "Farah Ali", service: "Haircut", dur: "45m", status: "Completed", tone: "success" as const },
];

const tabs = ["Today", "Upcoming", "Completed"];

export default function WorkerBookingsPage() {
  return (
    <>
      <PageHeader eyebrow="My Work" title="Bookings" subtitle="Every appointment assigned to you." />

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t, i) => (
          <button
            key={t}
            className={
              i === 0
                ? "border-b-2 border-primary px-4 py-2.5 text-sm font-semibold"
                : "border-b-2 border-transparent px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {t}
          </button>
        ))}
      </div>

      <Card>
        <Table>
          <THead>
            <tr>
              <TH>When</TH>
              <TH>Customer</TH>
              <TH>Service</TH>
              <TH>Duration</TH>
              <TH>Status</TH>
              <TH className="text-right">Action</TH>
            </tr>
          </THead>
          <tbody>
            {bookings.map((b) => (
              <TR key={b.id}>
                <TD className="whitespace-nowrap font-medium tabular-nums">{b.time}</TD>
                <TD>{b.customer}</TD>
                <TD className="text-muted-foreground">{b.service}</TD>
                <TD className="tabular-nums text-muted-foreground">{b.dur}</TD>
                <TD><Badge tone={b.tone}>{b.status}</Badge></TD>
                <TD className="text-right">
                  <Link href={`/worker/bookings/${b.id}`} className="text-xs font-semibold uppercase tracking-wider text-primary hover:underline">
                    Open
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
