import { Star, Scissors } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader, Card } from "@/components/customer/ui";
import { REVIEWS, BOOKINGS } from "@/components/customer/data";

// OWNER: Devanshi | MODULE: Customer Reviews (hardcoded)
export default function CustomerReviewsPage() {
  const reviewedServices = new Set(REVIEWS.map((r) => r.service));
  const pending = BOOKINGS.filter((b) => b.status === "COMPLETED" && !reviewedServices.has(b.service));

  return (
    <div>
      <PageHeader title="My Reviews" description="Share your experience and view past feedback." />

      {/* Pending review requests */}
      {pending.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-4 font-heading text-xl font-semibold">Awaiting your review</h2>
          <div className="space-y-4">
            {pending.map((b) => (
              <Card key={b.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <img src={b.image} alt={b.service} className="size-14 object-cover" />
                  <div>
                    <p className="font-heading text-base font-semibold">{b.service}</p>
                    <p className="text-sm text-muted-foreground">{b.stylist} · {b.date}</p>
                  </div>
                </div>
                <button className={cn(buttonVariants({ size: "sm" }))}>
                  <Star className="size-4" /> Write Review
                </button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Submitted reviews */}
      <h2 className="mb-4 font-heading text-xl font-semibold">Your reviews</h2>
      {REVIEWS.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          You haven&apos;t written any reviews yet.
        </Card>
      ) : (
        <div className="space-y-4">
          {REVIEWS.map((r) => (
            <Card key={r.id} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-heading text-base font-semibold">{r.service}</h3>
                  <p className="text-sm text-muted-foreground">{r.stylist} · {r.date}</p>
                </div>
                <div className="flex gap-0.5 text-primary">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={cn("size-4", i < r.rating ? "fill-current" : "text-muted-foreground/30")} />
                  ))}
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">&ldquo;{r.text}&rdquo;</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
