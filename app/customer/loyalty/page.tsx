import { Sparkles, Gift, Award, TrendingUp } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader, Card } from "@/components/customer/ui";
import { LOYALTY } from "@/components/customer/data";

// OWNER: Devanshi | MODULE: Customer Loyalty (hardcoded)
export default function CustomerLoyaltyPage() {
  const progress = (LOYALTY.points / (LOYALTY.points + LOYALTY.pointsToNext)) * 100;

  return (
    <div>
      <PageHeader title="Loyalty & Rewards" description="Earn points on every visit and redeem for discounts." />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Points hero */}
        <Card className="bg-primary p-7 text-primary-foreground lg:col-span-2">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary-foreground/70">
                <Sparkles className="size-5" />
                <span className="text-xs uppercase tracking-widest">Available points</span>
              </div>
              <p className="mt-3 font-heading text-6xl font-bold">{LOYALTY.points.toLocaleString("en-IN")}</p>
              <p className="mt-1 text-sm text-primary-foreground/70">≈ {`₹${Math.floor(LOYALTY.points / 2).toLocaleString("en-IN")}`} redeemable value</p>
            </div>
            <span className="inline-flex items-center gap-2 self-start bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest">
              <Award className="size-4" /> {LOYALTY.tier} Member
            </span>
          </div>

          <div className="mt-8">
            <div className="flex justify-between text-xs text-primary-foreground/70">
              <span>{LOYALTY.tier}</span>
              <span>{LOYALTY.pointsToNext} pts to {LOYALTY.nextTier}</span>
            </div>
            <div className="mt-2 h-2.5 w-full overflow-hidden bg-primary-foreground/20">
              <div className="h-full bg-primary-foreground" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <button className={cn(buttonVariants({ variant: "secondary" }), "mt-8 bg-background text-foreground hover:bg-background/90")}>
            <Gift className="size-4" /> Redeem Points
          </button>
        </Card>

        {/* Lifetime */}
        <Card className="flex flex-col justify-center gap-6 p-7">
          <div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="size-4 text-primary" />
              <span className="text-xs uppercase tracking-widest">Lifetime earned</span>
            </div>
            <p className="mt-2 font-heading text-3xl font-bold">{LOYALTY.lifetime.toLocaleString("en-IN")}</p>
          </div>
          <div className="border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">
              Earn <span className="font-semibold text-foreground">1 point</span> for every ₹10 spent.
              Redeem <span className="font-semibold text-foreground">2 points</span> = ₹1 off.
            </p>
          </div>
        </Card>
      </div>

      {/* History */}
      <Card className="mt-6">
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-heading text-lg font-semibold">Points history</h2>
        </div>
        <ul className="divide-y divide-border">
          {LOYALTY.history.map((h) => {
            const earn = h.type === "EARN";
            return (
              <li key={h.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="text-sm font-medium">{h.label}</p>
                  <p className="text-xs text-muted-foreground">{h.date}</p>
                </div>
                <span className={cn("font-heading text-base font-semibold", earn ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                  {earn ? "+" : "−"}{h.points} pts
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
