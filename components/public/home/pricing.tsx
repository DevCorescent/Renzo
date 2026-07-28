// OWNER: Gauransh | SECTION: Pricing (Luxury Made Affordable)
import Link from "next/link";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PILL_SOLID, PILL_OUTLINE } from "./home-ui";
import { MotionReveal, MotionStagger, MotionItem } from "./motion";
import { cn } from "@/lib/utils";
import { cmsIcon } from "@/lib/cms/icons";
import type { PricingData } from "@/lib/cms/schema";

export function Pricing({ data }: { data: PricingData }) {
  const tiers = data.tiers.filter((tier) => !tier.hidden);

  return (
   <section className="bg-stone-950 pt-6 pb-10 sm:pt-8 sm:pb-12 lg:pt-10 lg:pb-14">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <MotionReveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">
            {data.eyebrow}
          </p>

          <h2 className="mt-3 font-heading text-[clamp(1.9rem,6vw,3rem)] font-semibold leading-none tracking-tight text-white whitespace-nowrap">
            {data.title}
          </h2>

         <p className="mt-3 leading-relaxed text-stone-400">
            {data.paragraph}
          </p>
        </MotionReveal>

        <MotionStagger className="mt-8 sm:mt-10 lg:mt-12 grid gap-5 sm:gap-6 sm:grid-cols-2">
          {tiers.map((tier) => {
            const Icon = cmsIcon(tier.icon);

            return (
              <MotionItem
                key={tier.id}
                hover
                className={cn(
                  "flex h-full flex-col rounded-2xl border p-5 sm:p-6 lg:p-7",
                  tier.featured
                    ? "border-gold/40 bg-stone-900 ring-1 ring-gold/20"
                    : "border-white/10 bg-stone-900/40"
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-lg font-bold text-white">
                    {tier.name}
                  </h3>

                  <span className="inline-flex size-8 items-center justify-center rounded-lg bg-gold/15 text-gold ring-1 ring-gold/25">
                    <Icon className="size-4" />
                  </span>
                </div>

                <ul className="mt-5 space-y-3 border-t border-white/10 pt-5">
                  {tier.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span className="flex items-center gap-2 text-stone-300">
                        <Check className="size-4 shrink-0 text-gold" />
                        {item.label}
                      </span>

                      <span className="whitespace-nowrap text-stone-400">
                        {item.price}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                  <p className="flex items-baseline gap-1">
                    <span className="font-heading text-2xl font-extrabold text-gold">
                      {tier.monthly}
                    </span>

                    <span className="text-xs text-stone-400">/month</span>
                  </p>

                  <Link
                    href={data.ctaHref}
                    aria-label={`${data.ctaLabel} — ${tier.name}`}
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      tier.featured ? PILL_SOLID : PILL_OUTLINE,
                      "px-5"
                    )}
                  >
                    {data.ctaLabel}
                  </Link>
                </div>
              </MotionItem>
            );
          })}
        </MotionStagger>
      </div>
    </section>
  );
}