// OWNER: Hemant | MODULE: Marketing — Campaigns, Coupons, Offers
import { Plus, Megaphone, Ticket, Tag } from "lucide-react";
import { PageHeader, StatCard, Card, CardHeader, CardTitle, Badge, Table, THead, TH, TR, TD } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const campaigns = [
  { name: "Monsoon Glow", channel: "WhatsApp", sent: "8,400", opened: "62%", status: "Live", tone: "success" as const },
  { name: "Win-back Lapsed", channel: "Email", sent: "2,100", opened: "31%", status: "Live", tone: "success" as const },
  { name: "Diwali Teaser", channel: "SMS", sent: "—", opened: "—", status: "Scheduled", tone: "info" as const },
];

const coupons = [
  { code: "GLOW20", type: "20% off", uses: "312 / 1000", status: "Active", tone: "success" as const },
  { code: "FIRST500", type: "₹500 off first visit", uses: "890 / ∞", status: "Active", tone: "success" as const },
  { code: "SUMMER15", type: "15% off", uses: "500 / 500", status: "Exhausted", tone: "neutral" as const },
];

const offers = [
  { name: "Buy Facial, Get Threading Free", scope: "All branches", status: "Live", tone: "success" as const },
  { name: "Weekday Hair Spa ₹999", scope: "Bandra, CP", status: "Live", tone: "success" as const },
];

export default function SuperAdminMarketingPage() {
  return (
    <>
      <PageHeader eyebrow="Growth" title="Marketing" subtitle="Campaigns, coupons and promotional offers."
        actions={<Button size="sm"><Plus /> New campaign</Button>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active Campaigns" value="2" icon={Megaphone} />
        <StatCard label="Live Coupons" value="2" hint="1 exhausted" icon={Ticket} />
        <StatCard label="Running Offers" value="2" icon={Tag} />
      </div>

      <Card>
        <CardHeader><CardTitle>Campaigns</CardTitle></CardHeader>
        <Table>
          <THead><tr><TH>Campaign</TH><TH>Channel</TH><TH>Sent</TH><TH>Open Rate</TH><TH>Status</TH></tr></THead>
          <tbody>
            {campaigns.map((c) => (
              <TR key={c.name}>
                <TD className="font-medium">{c.name}</TD>
                <TD className="text-muted-foreground">{c.channel}</TD>
                <TD className="tabular-nums">{c.sent}</TD>
                <TD className="tabular-nums">{c.opened}</TD>
                <TD><Badge tone={c.tone}>{c.status}</Badge></TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Coupons</CardTitle></CardHeader>
          <Table>
            <THead><tr><TH>Code</TH><TH>Benefit</TH><TH>Used</TH><TH>Status</TH></tr></THead>
            <tbody>
              {coupons.map((c) => (
                <TR key={c.code}>
                  <TD className="font-mono font-medium">{c.code}</TD>
                  <TD className="text-muted-foreground">{c.type}</TD>
                  <TD className="tabular-nums">{c.uses}</TD>
                  <TD><Badge tone={c.tone}>{c.status}</Badge></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader><CardTitle>Offers</CardTitle></CardHeader>
          <Table>
            <THead><tr><TH>Offer</TH><TH>Scope</TH><TH>Status</TH></tr></THead>
            <tbody>
              {offers.map((o) => (
                <TR key={o.name}>
                  <TD className="font-medium">{o.name}</TD>
                  <TD className="text-muted-foreground">{o.scope}</TD>
                  <TD><Badge tone={o.tone}>{o.status}</Badge></TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </>
  );
}
