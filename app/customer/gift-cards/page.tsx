import { Gift, Plus, Calendar } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader, Card } from "@/components/customer/ui";
import { GIFT_CARDS, rupee, type GiftCardStatus } from "@/components/customer/data";

// OWNER: Devanshi | MODULE: Customer Gift Cards (hardcoded)
const STATUS_STYLES: Record<GiftCardStatus, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  REDEEMED: "bg-muted text-muted-foreground",
  EXPIRED: "bg-destructive/10 text-destructive",
};

export default function CustomerGiftCardsPage() {
  return (
    <div>
      <PageHeader
        title="Gift Cards"
        description="Redeem gift cards or buy one for someone special."
        action={
          <button className={cn(buttonVariants())}>
            <Plus className="size-4" /> Buy / Redeem
          </button>
        }
      />

      <div className="grid gap-6 sm:grid-cols-2">
        {GIFT_CARDS.map((gc) => {
          const used = gc.value - gc.balance;
          const pct = gc.value > 0 ? (gc.balance / gc.value) * 100 : 0;
          return (
            <Card key={gc.id} className="overflow-hidden">
              {/* Card face */}
              <div className="relative bg-primary p-6 text-primary-foreground">
                <div className="flex items-start justify-between">
                  <Gift className="size-8" />
                  <span className={cn("px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest", STATUS_STYLES[gc.status])}>
                    {gc.status}
                  </span>
                </div>
                <p className="mt-6 font-mono text-lg tracking-[0.2em]">{gc.code}</p>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-primary-foreground/60">Balance</p>
                    <p className="font-heading text-3xl font-bold">{rupee(gc.balance)}</p>
                  </div>
                  <p className="text-sm text-primary-foreground/70">of {rupee(gc.value)}</p>
                </div>
              </div>

              {/* Card meta */}
              <div className="space-y-3 p-6">
                {gc.status === "ACTIVE" && (
                  <div>
                    <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                      <span>{rupee(used)} used</span>
                      <span>{Math.round(pct)}% left</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden bg-muted">
                      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5"><Calendar className="size-4 text-primary" /> Expires {gc.expiry}</span>
                </div>
                <p className="text-xs text-muted-foreground">From: {gc.from}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
