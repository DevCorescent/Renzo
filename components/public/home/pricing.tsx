// OWNER: Gauransh | SECTION: Pricing (Luxury Made Affordable)
import Link from "next/link";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PILL_SOLID, PILL_OUTLINE } from "./home-ui";
import { MotionReveal, MotionStagger, MotionItem } from "./motion";
import { cn } from "@/lib/utils";
import { PRICING_TIERS } from "./home-data";

export function Pricing() {
  return (
    <section className="bg-stone-950 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <MotionReveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Membership</p>
          <h2 className="mt-3 font-heading text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Luxury Made Affordable
          </h2>
          <p className="mt-4 leading-relaxed text-stone-400">
            Join a Renzo membership and enjoy your favourite services for less — with priority
            booking and members-only perks.
          </p>
        </MotionReveal>

        <MotionStagger className="mt-14 grid gap-6 sm:grid-cols-2">
          {PRICING_TIERS.map((tier) => (
            <MotionItem
              key={tier.name}
              hover
              className={cn(
                "flex h-full flex-col rounded-2xl border p-7",
                tier.featured
                  ? "border-gold/40 bg-stone-900 ring-1 ring-gold/20"
                  : "border-white/10 bg-stone-900/40",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-lg font-bold text-white">{tier.name}</h3>
                <span className="inline-flex size-8 items-center justify-center rounded-lg bg-gold/15 text-gold ring-1 ring-gold/25">
                  <tier.icon className="size-4" />
                </span>
              </div>

              <ul className="mt-6 space-y-3 border-t border-white/10 pt-6">
                {tier.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="flex items-center gap-2 text-stone-300">
                      <Check className="size-4 shrink-0 text-gold" />
                      {item.label}
                    </span>
                    <span className="whitespace-nowrap text-stone-400">{item.price}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
                <p className="flex items-baseline gap-1">
                  <span className="font-heading text-2xl font-extrabold text-gold">
                    {tier.monthly}
                  </span>
                  <span className="text-xs text-stone-400">/month</span>
                </p>
                <Link
                  href="/packages"
                  aria-label={`Get started with ${tier.name}`}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    tier.featured ? PILL_SOLID : PILL_OUTLINE,
                    "px-5",
                  )}
                >
                  Get Started
                </Link>
              </div>
            </MotionItem>
          ))}
        </MotionStagger>
      </div>
    </section>
  );
}
