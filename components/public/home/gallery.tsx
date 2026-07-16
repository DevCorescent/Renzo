"use client";

// OWNER: Gauransh | SECTION: Studio gallery — infinite marquee with curved LED track
import Link from "next/link";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { PILL_SOLID } from "./home-ui";
import { MotionReveal } from "./motion";
import { cn } from "@/lib/utils";
import { GALLERY } from "./home-data";

export function Gallery() {
  const reduce = useReducedMotion();
  // Triple so the loop never shows a gap
  const track = [...GALLERY, ...GALLERY, ...GALLERY];

  return (
    <section className="overflow-hidden bg-stone-950 py-24 sm:py-32">
      {/* ── Curved LED marquee strip ─────────────────────────────────── */}
      <div className="relative" style={{ perspective: "1200px" }}>
        {/* Ambient top glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[#C4C9D1]/8 to-transparent"
        />

        {/* LED rail — top */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#C4C9D1]/70 to-transparent"
        />

        {/* LED rail — bottom */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#C4C9D1]/70 to-transparent"
        />

        {/* Ambient bottom glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#C4C9D1]/8 to-transparent"
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
        <div style={{ transform: "rotateX(4deg)", transformStyle: "preserve-3d" }}>
          <motion.div
            animate={reduce ? undefined : { x: ["0%", "-33.333%"] }}
            transition={{
              duration: 90,
              repeat: Infinity,
              ease: "linear",
            }}
            className="flex gap-4 py-10 will-change-transform"
            style={{ width: "max-content" }}
          >
            {track.map((image, i) => (
              <div
                key={image.src + i}
                className="relative aspect-[4/5] w-44 shrink-0 overflow-hidden rounded-2xl
                           ring-1 ring-[#C4C9D1]/25
                           shadow-[0_0_18px_-4px_rgba(196,201,209,0.25)]
                           transition-shadow duration-300
                           hover:shadow-[0_0_32px_-4px_rgba(196,201,209,0.55)]
                           hover:ring-[#C4C9D1]/60
                           sm:w-52 lg:w-60"
              >
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="15rem"
                  className="object-cover transition-transform duration-700 hover:scale-105"
                />
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Heading + CTA ─────────────────────────────────────────────── */}
      <MotionReveal className="mx-auto mt-16 max-w-2xl px-4 text-center">
        <h2 className="font-heading text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          Our Work Speaks for Itself
        </h2>
        <p className="mt-4 leading-relaxed text-stone-400">
          Step inside Renzo through our gallery. From chic hairstyles to flawless makeovers,
          every look is a reflection of our passion for beauty.
        </p>
        <Link
          href="/gallery"
          className={cn(buttonVariants({ size: "lg" }), PILL_SOLID, "mt-8")}
        >
          View All
        </Link>
      </MotionReveal>
    </section>
  );
}
