// OWNER: Hemant | MODULE: Membership Plans Management
import { Plus, Check } from "lucide-react";
import { PageHeader, Card, CardHeader, CardTitle, CardBody, Badge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const plans = [
  { name: "Silver", price: "₹2,999", period: "/year", members: 720, tone: "neutral" as const, perks: ["10% off all services", "Priority booking", "Birthday voucher"] },
  { name: "Gold", price: "₹5,999", period: "/year", members: 480, tone: "warning" as const, featured: true, perks: ["20% off all services", "Free monthly hair spa", "Priority booking", "2× loyalty points"] },
  { name: "Platinum", price: "₹11,999", period: "/year", members: 140, tone: "primary" as const, perks: ["30% off all services", "Free monthly treatment", "Dedicated stylist", "3× loyalty points", "Home service"] },
];

export default function SuperAdminMembershipsPage() {
  return (
    <>
      <PageHeader eyebrow="Loyalty" title="Membership Plans" subtitle="1,340 active members across 3 tiers."
        actions={<Button size="sm"><Plus /> New plan</Button>} />

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <Card key={p.name} className={p.featured ? "border-primary" : ""}>
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              {p.featured ? <Badge tone="primary">Most popular</Badge> : <Badge tone={p.tone}>{p.members} members</Badge>}
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <span className="font-heading text-3xl font-semibold tabular-nums">{p.price}</span>
                <span className="text-sm text-muted-foreground">{p.period}</span>
              </div>
              <ul className="space-y-2">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-500" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
              {p.featured && <p className="text-xs text-muted-foreground">{p.members} active members</p>}
              <Button variant="outline" className="w-full justify-center" size="sm">Edit plan</Button>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
