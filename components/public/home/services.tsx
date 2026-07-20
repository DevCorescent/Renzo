"use client";

// OWNER: Gauransh | SECTION: Signature services (horizontal image cards)
import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { buttonVariants } from "@/components/ui/button";
import { PILL_SOLID } from "./home-ui";
import { MotionStagger, MotionItem } from "./motion";
import { cn } from "@/lib/utils";
import { SERVICES } from "./home-data";

export function Services() {
  const scroller = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const check = () => {
      const atEnd = el.scrollWidth - el.clientWidth - el.scrollLeft < 24;
      setShowHint(!atEnd);
    };
    check();
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <section className="bg-stone-950 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="What we do"
          title="Our Signature Services"
          subtitle="From everyday grooming to special-occasion glam, our menu covers every look."
        />

        <div className="relative mt-8">
          <div ref={scroller} className="overflow-x-auto pb-4 pr-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <MotionStagger className="flex snap-x gap-5">
            {SERVICES.map((service) => (
              <MotionItem
                key={service.name}
                hover
                className={cn(
                  "group relative aspect-[3/4] shrink-0 snap-start overflow-hidden rounded-2xl ring-1 ring-white/10 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-black/50 hover:ring-white/20",
                  service.featured ? "w-80" : "w-64",
                )}
              >
                <Image
                  src={service.img}
                  alt={service.name}
                  fill
                  sizes="20rem"
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
                      "text-xs leading-relaxed text-stone-300",
                      service.featured
                        ? "mt-2"
                        : "mt-2 max-h-0 overflow-hidden opacity-0 transition-all duration-300 group-hover:max-h-28 group-hover:opacity-100",
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
              </MotionItem>
            ))}
          </MotionStagger>
          </div>

          {/* Scroll hint — fade + arrow, hides once user scrolls to the end */}
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 flex w-20 items-center justify-end bg-linear-to-l from-stone-950 to-transparent pb-4 transition-opacity duration-300",
              showHint ? "opacity-100" : "opacity-0",
            )}
          >
            <span className="mr-2 inline-flex size-8 items-center justify-center rounded-full border border-white/20 bg-stone-950/80 text-white backdrop-blur-sm">
              <ChevronRight className="size-4" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}