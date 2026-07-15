"use client";

// OWNER: Gauransh | SECTION: More Than a Salon, An Experience (+ statistics) — 2026 redesign
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PILL_SOLID, GLASS } from "./home-ui";
import { MotionReveal } from "./motion";
import { useInView } from "@/lib/hooks/use-in-view";
import { useCountUp } from "@/lib/hooks/use-count-up";
import { STATS, STATS_BLURB, type Stat } from "./home-data";

function StatItem({ stat, start, index }: { stat: Stat; start: boolean; index: number }) {
  const value = useCountUp(stat.value, { start });
  return (
    <div
      className={cn(
        "relative flex flex-col justify-between px-6 py-8 sm:px-8",
        "border-white/10 first:pl-0 sm:border-l sm:first:border-l-0"
      )}
    >
      <span
        aria-hidden
        className="mb-4 font-heading text-xs font-bold tracking-widest text-white/30"
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <p
        className="font-heading text-4xl font-semibold leading-none text-white sm:text-5xl"
        aria-hidden="true"
      >
        {value}
        {stat.suffix}
      </p>
      <p className="mt-3 text-sm font-medium uppercase tracking-wide text-[#B7BEC8]">
        <span className="sr-only">
          {stat.value}
          {stat.suffix} —{" "}
        </span>
        {stat.label}
      </p>
    </div>
  );
}

export function Experience() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const reduceMotion = useReducedMotion();

  return (
    <section id="about" className="relative overflow-hidden bg-[#0A0B0D] py-24 sm:py-32">
      {/* Ambient silver glow — matches Hero/Blog */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[-10%] top-1/3 size-[32rem] rounded-full bg-[#C4C9D1]/[0.06] blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <MotionReveal className="grid gap-8 lg:grid-cols-2 lg:items-end">
          <div>
            <div
              className={cn(
                GLASS,
                "mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-1.5"
              )}
            >
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C4C9D1]">
                Our Story
              </span>
            </div>
            <h2 className="group max-w-xl font-heading text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl xl:text-6xl">
              More Than a Salon, An{" "}
              <motion.span
                className="inline-block bg-[length:200%_100%] bg-gradient-to-r from-[#F2F2F2] via-[#9AA0AA] to-white bg-clip-text text-transparent transition-transform duration-500 group-hover:translate-x-1.5"
                animate={
                  reduceMotion
                    ? undefined
                    : { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }
                }
                transition={
                  reduceMotion
                    ? undefined
                    : { duration: 4, repeat: Infinity, ease: "linear" }
                }
              >
                Experience
              </motion.span>
            </h2>
          </div>
          <div className="space-y-5 lg:pb-2">
            <p className="max-w-md leading-relaxed text-[#B7BEC8]">
              At Renzo, we believe beauty is more than just a look — it&apos;s a feeling. Our
              mission is to create a space where every visit leaves you more confident than the
              last.
            </p>
            <Link
              href="/#about"
              className={cn(
                buttonVariants({ size: "sm" }),
                PILL_SOLID,
                "group inline-flex items-center gap-2 px-6"
              )}
            >
              Read More
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </MotionReveal>

        {/* Shared blurb line above the stat rail */}
        <p className="relative mt-16 max-w-lg text-sm leading-relaxed text-[#8D96A0]">
          {STATS_BLURB}
        </p>

        {/* Bento-style stat rail */}
        <div
          ref={ref}
          className={cn(
            GLASS,
            "relative mt-6 grid grid-cols-2 gap-x-2 gap-y-2 rounded-[28px] border border-white/10 p-2 sm:grid-cols-4 sm:gap-0 sm:p-0"
          )}
        >
          {STATS.map((stat, i) => (
            <StatItem key={stat.label} stat={stat} start={inView} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}