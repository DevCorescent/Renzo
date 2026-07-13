"use client";

// OWNER: Gauransh | SECTION: Homepage hero (layered, dark, luxury)
import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PILL_SOLID } from "./home-ui";
import { HERO_IMAGE, STYLISTS } from "./home-data";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const imageRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: imageRef,
    offset: ["start start", "end start"],
  });
  const parallax = useTransform(scrollYProgress, [0, 1], ["0%", "9%"]);

  return (
    <section className="relative overflow-hidden bg-stone-950 text-stone-50">
      {/* Oversized brand watermark */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-8 overflow-hidden"
      >
        <span className="-rotate-6 whitespace-nowrap font-heading text-[15vw] font-extrabold leading-none tracking-tighter text-white/[0.035]">
          Renzo
        </span>
      </div>
      {/* Ambient orange glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] size-[42rem] rounded-full bg-gold/10 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-20 lg:pt-14">
        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="max-w-3xl font-heading text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl"
        >
          Where Beauty
          <br />
          Meets <span className="text-gold">Confidence</span>
        </motion.h1>

        {/* Image with layered overlays */}
        <motion.div
          ref={imageRef}
          initial={reduce ? false : { opacity: 0, y: 30 }}
          animate={reduce ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: EASE }}
          className="relative mt-8 aspect-[16/12] w-full overflow-hidden rounded-3xl ring-1 ring-white/10 sm:aspect-[16/9] lg:aspect-[16/7]"
        >
          <motion.div style={reduce ? undefined : { y: parallax }} className="absolute inset-[-10%]">
            <Image
              src={HERO_IMAGE}
              alt="Client being styled at Renzo salon"
              fill
              preload
              sizes="100vw"
              className="object-cover"
            />
          </motion.div>
          <div
            aria-hidden
            className="absolute inset-0 bg-linear-to-t from-stone-950/85 via-stone-950/25 to-transparent"
          />

          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-5 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-10">
            <div className="max-w-sm space-y-5">
              <p className="text-sm leading-relaxed text-stone-200 sm:text-base">
                Discover luxury hair &amp; beauty services designed to bring out your natural glow.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/book" className={cn(buttonVariants({ size: "lg" }), PILL_SOLID)}>
                  Book Now
                  <ArrowRight className="size-4" />
                </Link>
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-stone-200 backdrop-blur transition hover:bg-white/10 hover:text-white"
                >
                  Sign in
                </Link>
              </div>
            </div>

            {/* Social-proof chip */}
            <div className="inline-flex items-center gap-3 self-start rounded-2xl border border-white/15 bg-stone-950/50 px-4 py-3 backdrop-blur sm:self-end">
              <div className="flex -space-x-2">
                {STYLISTS.slice(0, 4).map((s) => (
                  <Image
                    key={s.name}
                    src={s.img}
                    alt={s.name}
                    width={32}
                    height={32}
                    className="size-8 rounded-full border-2 border-stone-950 object-cover"
                  />
                ))}
              </div>
              <p className="max-w-[10rem] text-xs leading-snug text-stone-200">
                Authentic reviews from clients who trust us
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
