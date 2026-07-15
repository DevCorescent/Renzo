"use client";

// OWNER: Gauransh | SECTION: Signature services — infinite curved-LED marquee
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { PILL_SOLID } from "./home-ui";
import { MotionReveal } from "./motion";
import { cn } from "@/lib/utils";
import { SERVICES } from "./home-data";

export function Services() {
  const reduce = useReducedMotion();
  // Duplicate so the loop never shows a gap
  const track = [...SERVICES, ...SERVICES];

  return (
    <section className="overflow-hidden bg-stone-950 py-24 sm:py-32">
      {/* ── Section header ─────────────────────────────────────────────── */}
      <MotionReveal className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#C8A96A]">
              What we do
            </p>
            <h2 className="font-heading text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Our Signature Services
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-stone-400 sm:text-right">
            From everyday grooming to special-occasion glam, our menu covers every look.
          </p>
        </div>
      </MotionReveal>

      {/* ── Curved LED marquee strip ─────────────────────────────────── */}
      <div className="relative mt-14" style={{ perspective: "1400px" }}>
        {/* Ambient top glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[#C8A96A]/8 to-transparent"
        />

        {/* LED rail — top */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C8A96A]/70 to-transparent"
        />

        {/* LED rail — bottom */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#C8A96A]/70 to-transparent"
        />

        {/* Ambient bottom glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#C8A96A]/8 to-transparent"
        />

        {/* Left / right fade masks */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-stone-950 to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-stone-950 to-transparent"
        />

        {/* Scrolling row — slight rotateX gives the curved-track illusion */}
        <div style={{ transform: "rotateX(3deg)", transformStyle: "preserve-3d" }}>
          <motion.div
            animate={reduce ? undefined : { x: ["0%", "-50%"] }}
            transition={{
              duration: 80,
              repeat: Infinity,
              ease: "linear",
            }}
            className="flex gap-5 py-10 will-change-transform"
            style={{ width: "max-content" }}
          >
            {track.map((service, i) => (
              <Link
                key={service.name + i}
                href="/services"
                aria-label={`Book ${service.name}`}
                className={cn(
                  "group relative shrink-0 overflow-hidden rounded-2xl",
                  "ring-1 ring-[#C8A96A]/20",
                  "shadow-[0_0_18px_-4px_rgba(200,169,106,0.2)]",
                  "transition-shadow duration-300",
                  "hover:shadow-[0_0_36px_-4px_rgba(200,169,106,0.55)]",
                  "hover:ring-[#C8A96A]/55",
                  service.featured
                    ? "aspect-[3/4] w-72 sm:w-80"
                    : "aspect-[3/4] w-56 sm:w-64"
                )}
              >
                <Image
                  src={service.img}
                  alt={service.name}
                  fill
                  sizes="20rem"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/30 to-transparent"
                />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C8A96A]">
                    {service.price}
                  </p>
                  <h3 className="mt-1 font-heading text-lg font-semibold text-white">
                    {service.name}
                  </h3>
                  <p className="mt-1.5 max-h-0 overflow-hidden text-xs leading-relaxed text-stone-300 opacity-0 transition-all duration-300 group-hover:max-h-20 group-hover:opacity-100">
                    {service.desc}
                  </p>
                  <span
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      PILL_SOLID,
                      "mt-3 inline-flex scale-90 opacity-0 transition-all duration-300 group-hover:scale-100 group-hover:opacity-100"
                    )}
                  >
                    Book Now
                  </span>
                </div>
              </Link>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <MotionReveal className="mx-auto mt-12 max-w-7xl px-4 text-center sm:px-6 lg:px-8">
        <Link
          href="/services"
          className={cn(buttonVariants({ size: "lg" }), PILL_SOLID)}
        >
          View All Services
        </Link>
      </MotionReveal>
    </section>
  );
}
