import { Crown, Check, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PageHeader, Card } from "@/components/customer/ui";
import { MEMBERSHIP, rupee } from "@/components/customer/data";

// OWNER: Devanshi | MODULE: Customer Membership (hardcoded)
export default function CustomerMembershipPage() {
  return (
    <div>
      <PageHeader title="Membership" description="Your plan, benefits and renewal details." />

      {/* Active plan */}
      {MEMBERSHIP.active && (
        <Card className="mb-10 overflow-hidden">
          <div className="flex flex-col gap-6 bg-primary p-7 text-primary-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="inline-flex size-14 items-center justify-center bg-primary-foreground/15">
                <Crown className="size-7" />
              </span>
              <div>
                <p className="text-xs uppercase tracking-widest text-primary-foreground/70">Active plan</p>
                <p className="font-heading text-2xl font-bold">{MEMBERSHIP.plan}</p>
                <p className="text-sm text-primary-foreground/70">Renews on {MEMBERSHIP.renewsOn}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-heading text-3xl font-bold">{rupee(MEMBERSHIP.price)}</p>
              <p className="text-sm text-primary-foreground/70">per {MEMBERSHIP.cycle}</p>
            </div>
          </div>
          <div className="grid gap-3 p-7 sm:grid-cols-2">
            {MEMBERSHIP.benefits.map((b) => (
              <div key={b} className="flex items-center gap-2.5 text-sm">
                <Check className="size-4 shrink-0 text-primary" /> {b}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Plans */}
      <h2 className="mb-4 font-heading text-xl font-semibold">Explore plans</h2>
      <div className="grid gap-6 lg:grid-cols-3">
        {MEMBERSHIP.plans.map((plan) => {
          const current = plan.name === MEMBERSHIP.plan;
          return (
            <Card key={plan.name} className={cn("flex flex-col p-7", current && "border-primary ring-1 ring-primary")}>
              {current && (
                <span className="mb-3 inline-flex w-fit items-center gap-1 bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary-foreground">
                  <Sparkles className="size-3" /> Current
                </span>
              )}
              <h3 className="font-heading text-xl font-semibold">{plan.name}</h3>
              <p className="mt-2">
                <span className="font-heading text-3xl font-bold">{rupee(plan.price)}</span>
                <span className="text-sm text-muted-foreground"> / {plan.cycle}</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.perks.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {p}
                  </li>
                ))}
              </ul>
              <button
                className={cn(buttonVariants({ variant: current ? "outline" : "default" }), "mt-7 w-full")}
                disabled={current}
              >
                {current ? "Current Plan" : "Choose Plan"}
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
