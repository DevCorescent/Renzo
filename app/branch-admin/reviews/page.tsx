// OWNER: Hemant | MODULE: Branch Review Moderation + Portfolio approval queue
import { Check, X, Star } from "lucide-react";
import { PageHeader, Card, CardHeader, CardTitle, CardBody, Badge } from "@/components/shared/ui";
import { Button } from "@/components/ui/button";

const reviews = [
  { customer: "Sneha Kapoor", worker: "Priya Nair", rating: 5, text: "Best balayage I've had in years. Priya really understood what I wanted.", when: "2h ago" },
  { customer: "Karan Malhotra", worker: "Arjun Singh", rating: 4, text: "Good haircut, slightly long wait time but worth it.", when: "5h ago" },
  { customer: "Anonymous", worker: "Zoya Khan", rating: 2, text: "Facial was rushed. Expected more for the price.", when: "1d ago" },
];

const portfolio = [
  { worker: "Priya Nair", title: "Rose Gold Melt", hue: "from-pink-200 to-fuchsia-300" },
  { worker: "Neha Gupta", title: "Chrome Nails", hue: "from-slate-200 to-slate-400" },
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

export default function BranchReviewsPage() {
  return (
    <>
      <PageHeader eyebrow="Moderation" title="Reviews" subtitle="Approve customer reviews and portfolio uploads before they go public." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <CardTitle className="text-muted-foreground">Pending Reviews · 3</CardTitle>
          {reviews.map((r, i) => (
            <Card key={i}>
              <CardBody className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{r.customer} <span className="text-sm font-normal text-muted-foreground">on {r.worker}</span></p>
                    <div className="mt-1 flex items-center gap-2"><Stars n={r.rating} /><span className="text-xs text-muted-foreground">{r.when}</span></div>
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

        <div className="space-y-4">
          <CardTitle className="text-muted-foreground">Portfolio Queue · 2</CardTitle>
          {portfolio.map((p, i) => (
            <Card key={i} className="overflow-hidden">
              <div className={`aspect-[4/3] bg-gradient-to-br ${p.hue}`} />
              <CardBody className="space-y-3">
                <div>
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground">{p.worker}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 justify-center"><Check /> Approve</Button>
                  <Button size="sm" variant="destructive" className="flex-1 justify-center"><X /> Reject</Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
