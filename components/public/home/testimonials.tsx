"use client";

// OWNER: Gauransh | SECTION: Client testimonials (scrollable, arrow controls)
import { useRef } from "react";
import { Star, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TESTIMONIALS } from "./home-data";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Testimonials() {
  const scroller = useRef<HTMLDivElement>(null);

  const scrollByCards = (dir: number) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className="bg-stone-950 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C4C9D1]">Kind words</p>
            <h2 className="mt-3 font-heading text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Hear from the Renzo Family
            </h2>
          </div>
          <div className="hidden shrink-0 gap-3 sm:flex">
            <button
              type="button"
              onClick={() => scrollByCards(-1)}
              aria-label="Previous testimonials"
              className="inline-flex size-12 items-center justify-center rounded-full border border-white/30 bg-white/5 text-white shadow-lg shadow-black/20 transition-all hover:border-white/50 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ArrowLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => scrollByCards(1)}
              aria-label="Next testimonials"
              className="inline-flex size-12 items-center justify-center rounded-full bg-white text-stone-900 shadow-lg shadow-black/20 transition-all hover:bg-white/90 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ArrowRight className="size-5" />
            </button>
          </div>
        </div>

        <div
          ref={scroller}
          className="mt-14 flex snap-x gap-8 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TESTIMONIALS.map((t, i) => (
            <figure
              key={t.name}
              className={cn(
                "flex w-[88%] shrink-0 snap-start flex-col rounded-2xl border p-8 sm:w-[calc(50%-1rem)] sm:p-10 lg:w-[calc(33.333%-1.34rem)]",
                i === 1
                  ? "border-white/15 bg-stone-900 shadow-2xl"
                  : "border-white/10 bg-stone-900/40 opacity-90",
              )}
            >
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5 text-[#C4C9D1]" aria-label={`Rated ${t.rating} out of 5`}>
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star key={s} className="size-4 fill-current" />
                  ))}
                </div>
                <span className="text-sm text-stone-400">({t.rating.toFixed(1)})</span>
              </div>
              <blockquote className="mt-7 flex-1 text-base leading-relaxed text-stone-300">
                &ldquo;{t.text}&rdquo;
              </blockquote>
              <figcaption className="mt-8 flex items-center gap-3">
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-[#C4C9D1]/15 font-heading text-sm font-semibold text-[#C4C9D1] ring-1 ring-[#C4C9D1]/20">
                  {initials(t.name)}
                </span>
                <span>
                  <span className="block font-heading text-base font-semibold text-white">
                    {t.name}
                  </span>
                  <span className="block text-xs text-stone-400">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}