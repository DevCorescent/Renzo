"use client";

// OWNER: Gauransh | SECTION: More Than a Salon, An Experience (+ statistics)
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PILL_SOLID } from "./home-ui";
import { MotionReveal } from "./motion";
import { useInView } from "@/lib/hooks/use-in-view";
import { useCountUp } from "@/lib/hooks/use-count-up";
import { STATS, STATS_BLURB, type Stat } from "./home-data";

function StatItem({ stat, start }: { stat: Stat; start: boolean }) {
  const value = useCountUp(stat.value, { start });
  return (
    <div>
      <p className="font-heading text-4xl font-extrabold text-gold sm:text-5xl" aria-hidden="true">
        {value}
        {stat.suffix}
      </p>
      <p className="mt-2 max-w-[16rem] text-sm leading-snug text-stone-400">
        <span className="sr-only">
          {stat.value}
          {stat.suffix} —{" "}
        </span>
        {STATS_BLURB}
      </p>
    </div>
  );
}

export function Experience() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);

  return (
    <section id="about" className="bg-stone-950 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <MotionReveal className="grid gap-8 lg:grid-cols-2 lg:items-end">
          <h2 className="font-heading text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            More Than a Salon,
            <br />
            An Experience
          </h2>
          <div className="space-y-5 lg:pb-2">
            <p className="leading-relaxed text-stone-400">
              At Renzo, we believe beauty is more than just a look — it&apos;s a feeling. Our
              mission is to create a space where every visit leaves you more confident than the last.
            </p>
            <Link href="/#about" className={cn(buttonVariants({ size: "sm" }), PILL_SOLID, "px-6")}>
              Read More
            </Link>
          </div>
        </MotionReveal>

        <div
          ref={ref}
          className="mt-16 grid grid-cols-2 gap-x-6 gap-y-10 border-t border-white/10 pt-12 lg:grid-cols-4"
        >
          {STATS.map((stat) => (
            <StatItem key={stat.label} stat={stat} start={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}
