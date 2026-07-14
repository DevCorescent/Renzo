"use client";

// OWNER: Gauransh | Arc/fan gallery for the Signature Services row.
// Cards sit on a shallow curve: each one is tilted and dropped by how far it is
// from the centre of the row, and the whole fan splays open from a converged
// stack as the row scrolls into view. Reduced-motion renders the flat row.
import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PILL_SOLID } from "./home-ui";
import { SERVICES, type Service } from "./home-data";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Shape of the curve. */
const MAX_ROTATE = 6; // deg of tilt on the outermost cards
const MAX_DROP = 26; // px the outermost cards sink below the centre ones
const CONVERGE = 130; // px each card is pulled toward the centre before it opens
const LIFT = 44; // px the fan rises as it opens

/** Signed distance from the row's centre, -1 (first card) … 1 (last card). */
function offsetFromCentre(index: number, count: number) {
  if (count < 2) return 0;
  return (index - (count - 1) / 2) / ((count - 1) / 2);
}

function ArcCard({
  service,
  progress,
  t,
}: {
  service: Service;
  progress: MotionValue<number>;
  /** Signed distance from the centre of the row, -1 … 1. */
  t: number;
}) {
  // The fan opens as `progress` runs 0 → 1: cards slide out from the centre,
  // settle onto the curve, and take on their tilt.
  const x = useTransform(progress, [0, 1], [-t * CONVERGE, 0]);
  const y = useTransform(progress, [0, 1], [LIFT, t * t * MAX_DROP]);
  const rotate = useTransform(progress, [0, 1], [0, t * MAX_ROTATE]);
  const scale = useTransform(progress, [0, 1], [0.9, 1]);
  const opacity = useTransform(progress, [0, 0.35], [0, 1]);

  return (
    <motion.div
      style={{ x, y, rotate, scale, opacity }}
      className="shrink-0 snap-start [transform-origin:center_bottom] will-change-transform"
    >
      <ArcCardBody service={service} />
    </motion.div>
  );
}

/** The card itself — hover lives here so it can't fight the arc transform above. */
function ArcCardBody({ service }: { service: Service }) {
  const reduce = useReducedMotion();
  return (
    <motion.article
      whileHover={reduce ? undefined : { y: -14, scale: 1.04 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="group relative aspect-[3/4] w-56 overflow-hidden rounded-2xl ring-1 ring-white/10 sm:w-64 lg:w-72"
    >
      <Image
        src={service.img}
        alt={service.name}
        fill
        sizes="(min-width: 1024px) 18rem, (min-width: 640px) 16rem, 14rem"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-stone-950 via-stone-950/30 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <h3 className="font-heading text-lg font-bold text-white">{service.name}</h3>
        <p
          className={cn(
            "mt-2 text-xs leading-relaxed text-stone-300",
            !service.featured &&
              "max-h-0 overflow-hidden opacity-0 transition-all duration-300 group-hover:max-h-28 group-hover:opacity-100",
          )}
        >
          {service.desc}
        </p>
        <Link
          href="/services"
          aria-label={`Book ${service.name}`}
          className={cn(
            buttonVariants({ size: "sm" }),
            PILL_SOLID,
            "mt-3",
            service.featured ? "inline-flex" : "hidden group-hover:inline-flex",
          )}
        >
          Book Now
        </Link>
      </div>
    </motion.article>
  );
}

export function ServicesArc() {
  const rowRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // 0 when the row's top reaches the bottom of the viewport, 1 once its centre
  // is comfortably on screen — so the fan is fully open before it's read.
  const { scrollYProgress } = useScroll({
    target: rowRef,
    offset: ["start end", "center 65%"],
  });
  const progress = useSpring(scrollYProgress, {
    stiffness: 90,
    damping: 22,
    restDelta: 0.001,
  });

  return (
    <div
      ref={rowRef}
      className="mt-14 flex snap-x items-center justify-start gap-5 overflow-x-auto px-1 pb-16 pt-6 [-ms-overflow-style:none] [scrollbar-width:none] lg:justify-center [&::-webkit-scrollbar]:hidden"
    >
      {SERVICES.map((service, i) =>
        reduce ? (
          <div key={service.name} className="shrink-0 snap-start">
            <ArcCardBody service={service} />
          </div>
        ) : (
          <ArcCard
            key={service.name}
            service={service}
            progress={progress}
            t={offsetFromCentre(i, SERVICES.length)}
          />
        ),
      )}
    </div>
  );
}