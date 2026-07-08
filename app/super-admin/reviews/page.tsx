// OWNER: Hemant | MODULE: Global Review Moderation
import { Check, X, Star, Flag } from "lucide-react";
import { PageHeader, StatCard, Card, CardHeader, CardTitle, CardBody, Badge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const reviews = [
  { customer: "Meera Iyer", branch: "Banjara Hills", worker: "Vikram Rao", rating: 5, text: "Consistently excellent. My go-to salon in the city.", when: "1h ago", flagged: false },
  { customer: "Anonymous", branch: "Koramangala", worker: "Imran Qureshi", rating: 1, text: "Rude staff and overpriced. Would not recommend.", when: "3h ago", flagged: true },
  { customer: "Karan Malhotra", branch: "Bandra", worker: "Arjun Singh", rating: 4, text: "Solid haircut. Wait was a bit long.", when: "6h ago", flagged: false },
];

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={`size-3.5 ${i < n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
      ))}
    </span>
  );
}

export default function SuperAdminReviewsPage() {
  return (
    <>
      <PageHeader eyebrow="Moderation" title="Reviews" subtitle="Platform-wide review moderation and escalations." />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Avg Rating" value="4.7" delta={{ value: "0.1", positive: true }} icon={Star} />
        <StatCard label="Pending" value="12" hint="need action" />
        <StatCard label="Flagged" value="3" hint="low rating" icon={Flag} />
        <StatCard label="This Month" value="1,204" hint="total reviews" />
      </div>

      <div className="space-y-4">
        {reviews.map((r, i) => (
          <Card key={i} className={r.flagged ? "border-destructive/40" : ""}>
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {r.customer}
                    <span className="text-sm font-normal text-muted-foreground"> · {r.branch} · {r.worker}</span>
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Stars n={r.rating} />
                    <span className="text-xs text-muted-foreground">{r.when}</span>
                    {r.flagged && <Badge tone="danger">Flagged</Badge>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline"><Check /> Approve</Button>
                  <Button size="sm" variant="destructive"><X /> Reject</Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">“{r.text}”</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
