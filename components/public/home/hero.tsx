"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowDown, Star, Sparkles } from "lucide-react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from "framer-motion";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { GLASS } from "./home-ui";
import { HERO_IMAGE, STYLISTS, TESTIMONIALS } from "./home-data";

const EASE = [0.22, 1, 0.36, 1] as const;

const RATING =
  TESTIMONIALS.reduce((sum, t) => sum + t.rating, 0) / TESTIMONIALS.length;

const STATS = [
  { value: "15K+", label: "Happy Clients" },
  { value: "12+", label: "Years Experience" },
  { value: RATING.toFixed(1), label: "Google Rating" },
  { value: "40+", label: "Expert Stylists" },
];

const MARQUEE_ITEMS = [
  "Haircuts",
  "Colour & Balayage",
  "Bridal Styling",
  "Spa Treatments",
  "Skin Facials",
  "Nail Care",
];

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1, delayChildren: 0.15 },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

const wordVariant: Variants = {
  hidden: { y: "115%" },
  show: { y: "0%", transition: { duration: 0.85, ease: EASE } },
};

function RevealWords({
  words,
  className,
  gradient,
}: {
  words: string[];
  className?: string;
  gradient?: boolean;
}) {
  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={word + i} className="mr-[0.28em] inline-block overflow-hidden pb-[0.08em] align-bottom last:mr-0">
          <motion.span
            variants={wordVariant}
            className={cn(
              "inline-block",
              gradient &&
                "bg-gradient-to-r from-[#EAD7AA] via-[#C8A96A] to-[#F2E2BF] bg-clip-text text-transparent"
            )}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

export function Hero() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });

  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section
      ref={sectionRef}
      aria-labelledby="hero-heading"
      className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-[#0A0B0D] text-[#F5F5F2]"
    >
      {/* Full-bleed cinematic background */}
      <div className="absolute inset-0">
        <motion.div
          style={reduceMotion ? undefined : { scale: imageScale }}
          animate={reduceMotion ? undefined : { scale: [1, 1.06, 1] }}
          transition={
            reduceMotion
              ? undefined
              : { duration: 24, repeat: Infinity, ease: "linear" }
          }
          className="absolute inset-0"
        >
          <Image
            src={HERO_IMAGE}
            alt="Luxury salon interior with a professional hairstylist styling a client at Renzo."
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        </motion.div>

        {/* Cinematic colour + vignette grade */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(200,169,106,.16),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(20,22,25,.4),transparent_50%)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0B0D] via-[#0A0B0D]/70 to-[#0A0B0D]/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0A0B0D]/85 via-[#0A0B0D]/30 to-transparent" />

        {/* Grain */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-soft-light"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 25%, rgba(255,255,255,.4) 1px, transparent 1px), radial-gradient(circle at 75% 75%, rgba(255,255,255,.3) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
      </div>

      {/* Watermark */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 top-0 overflow-hidden"
      >
        <span className="-rotate-6 whitespace-nowrap font-heading text-[16vw] font-black tracking-[-0.08em] text-white/[0.03]">
          RENZO
        </span>
      </div>

      {/* Main content */}
      <motion.div
        style={reduceMotion ? undefined : { y: contentY, opacity: contentOpacity }}
        variants={container}
        initial={reduceMotion ? false : "hidden"}
        animate={reduceMotion ? undefined : "show"}
        className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center px-5 pt-28 sm:px-8 lg:px-10"
      >
        <div className="grid gap-14 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            {/* Eyebrow */}
            <motion.div variants={fadeUp}>
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/80 px-5 py-2 backdrop-blur-xl">
                <Sparkles className="h-4 w-4 text-[#C8A96A]" />
                <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#D9D9D6]">
                  Luxury Hair &amp; Beauty Studio
                </span>
              </div>
            </motion.div>

           {/* Headline with word-reveal */}
<h1
  id="hero-heading"
  className="mt-8 font-heading text-4xl font-semibold tracking-tight text-white sm:text-5xl"
>
  <RevealWords words={["Where", "Beauty"]} className="block" />

  <div className="block">
    <RevealWords words={["Meets"]} className="inline-block mr-3" />

    <motion.span
      variants={wordVariant}
      animate={{
        backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
        scale: [1, 1.03, 1],
        textShadow: [
          "0 0 0px rgba(200,169,106,0)",
          "0 0 18px rgba(200,169,106,.7)",
          "0 0 0px rgba(200,169,106,0)",
        ],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: "linear",
      }}
      className="inline-block bg-gradient-to-r from-[#EAD7AA] via-[#C8A96A] to-[#F2E2BF] bg-[length:250%_100%] bg-clip-text text-transparent"
    >
      Confidence
    </motion.span>
  </div>
</h1>

            {/* Sub copy */}
            <motion.p
              variants={fadeUp}
              className="mt-8 max-w-lg text-base leading-8 text-[#C3C8CE] sm:text-lg"
            >
              Luxury haircuts, premium colouring, skin treatments and
              personalised styling — crafted with precision by expert
              stylists, for a look that carries into everything you do.
            </motion.p>

            {/* CTAs */}
            <motion.div variants={fadeUp} className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/book"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "group relative overflow-hidden rounded-full bg-[#C8A96A] px-8 text-black shadow-[0_10px_35px_-8px_rgba(200,169,106,.6)] transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] hover:bg-[#D8B87A] hover:shadow-[0_18px_50px_-10px_rgba(200,169,106,.8)]"
                )}
              >
                <span className="relative z-10 flex items-center">
                  Book Appointment
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                />
              </Link>

              <Link
                href="/services"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  GLASS,
                  "rounded-full border border-white/15 bg-white/5 px-8 text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/10"
                )}
              >
                Explore Services
              </Link>

              {/* Compact trust line */}
              <div className="ml-1 flex items-center gap-3">
                <div className="flex -space-x-3">
                  {STYLISTS.slice(0, 4).map((stylist) => (
                    <Image
                      key={stylist.name}
                      src={stylist.img}
                      alt={stylist.name}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded-full border-2 border-[#0A0B0D] object-cover"
                    />
                  ))}
                </div>
                <div className="text-xs leading-tight text-[#B7BEC8]">
                  <div className="flex items-center gap-1 text-white">
                    <Star className="h-3.5 w-3.5 fill-[#C8A96A] text-[#C8A96A]" />
                    <span className="font-semibold">{RATING.toFixed(1)}</span>
                  </div>
                  <span>15,000+ happy clients</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Vertical stat rail — desktop only */}
          <motion.div
            variants={fadeUp}
            className="hidden w-56 shrink-0 divide-y divide-white/10 rounded-[28px] border border-white/10 bg-black/80 backdrop-blur-xl lg:block"
          >
            {STATS.map((stat) => (
              <div key={stat.label} className="px-6 py-5 first:pt-6 last:pb-6">
                <p className="text-3xl font-black text-[#C8A96A]">{stat.value}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-[#B7BEC8]">
                  {stat.label}
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Marquee strip */}
      <div className="relative z-10 mt-16 border-t border-white/10 bg-white/[0.03] backdrop-blur-sm">
        <div className="flex overflow-hidden py-4">
          <motion.div
            animate={reduceMotion ? undefined : { x: ["0%", "-50%"] }}
            transition={
              reduceMotion
                ? undefined
                : { duration: 26, repeat: Infinity, ease: "linear" }
            }
            className="flex shrink-0 items-center gap-8 pr-8"
          >
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((label, i) => (
              <span
                key={label + i}
                className="flex items-center gap-8 whitespace-nowrap text-sm uppercase tracking-[0.2em] text-white/50"
              >
                {label}
                <span aria-hidden className="text-[#C8A96A]/70">
                  •
                </span>
              </span>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={reduceMotion ? undefined : { opacity: 1 }}
        transition={{ delay: 1 }}
        className="relative z-10 flex items-center justify-center gap-2 py-4 text-[#8D96A0]"
      >
        <span className="text-[11px] uppercase tracking-[0.35em]">Scroll</span>
        <motion.span
          animate={reduceMotion ? undefined : { y: [0, 5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </motion.span>
      </motion.div>
    </section>
  );
}