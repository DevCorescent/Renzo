"use client";

// OWNER: Gauransh | SECTION: Client testimonials (scrollable, arrow controls)

import { useRef } from "react";
import { ArrowLeft, ArrowRight, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TestimonialsData } from "@/lib/cms/schema";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function Testimonials({ data }: { data: TestimonialsData }) {
  const scroller = useRef<HTMLDivElement>(null);

  const items = data.items.filter((item) => !item.hidden);

  const scrollByCards = (direction: number) => {
    const element = scroller.current;
    if (!element) return;

    element.scrollBy({
      left: direction * element.clientWidth * 0.85,
      behavior: "smooth",
    });
  };

  return (
    <section className="bg-stone-950 py-8 sm:py-12 lg:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C4C9D1]">
              {data.eyebrow}
            </p>

            <h2 className="mt-3 font-heading text-[clamp(1.85rem,6vw,3rem)] font-semibold leading-none tracking-tight text-white whitespace-nowrap">
              {data.title}
            </h2>
          </div>

          <div className="hidden shrink-0 gap-3 sm:flex">
            <button
              type="button"
              aria-label="Previous testimonials"
              onClick={() => scrollByCards(-1)}
              className="inline-flex size-12 items-center justify-center rounded-full border border-white/30 bg-white/5 text-white shadow-lg shadow-black/20 transition-all hover:border-white/50 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ArrowLeft className="size-5" />
            </button>

            <button
              type="button"
              aria-label="Next testimonials"
              onClick={() => scrollByCards(1)}
              className="inline-flex size-12 items-center justify-center rounded-full bg-white text-stone-900 shadow-lg shadow-black/20 transition-all hover:scale-105 hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ArrowRight className="size-5" />
            </button>
          </div>
        </div>

        <div
          ref={scroller}
          className="mt-8 flex snap-x gap-6 overflow-x-auto pb-4 scroll-smooth lg:gap-8 sm:mt-10 lg:mt-12 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((testimonial, index) => (
            <figure
              key={testimonial.id}
              className={cn(
                "flex w-[88%] shrink-0 snap-start flex-col rounded-2xl border p-5 sm:w-[calc(50%-1rem)] sm:p-6 lg:w-[calc(33.333%-1.34rem)] lg:p-8",
                index === 1
                  ? "border-white/15 bg-stone-900 shadow-2xl"
                  : "border-white/10 bg-stone-900/40 opacity-90"
              )}
            >
              <div className="flex items-center gap-2">
                <div
                  className="flex gap-0.5 text-[#C4C9D1]"
                  aria-label={`Rated ${testimonial.rating} out of 5`}
                >
                  {Array.from({ length: 5 }).map((_, star) => (
                    <Star
                      key={star}
                      className="size-4 fill-current"
                    />
                  ))}
                </div>

                <span className="text-sm text-stone-400">
                  ({testimonial.rating.toFixed(1)})
                </span>
              </div>

              <blockquote className="mt-6 flex-1 text-base leading-relaxed text-stone-300">
                &ldquo;{testimonial.text}&rdquo;
              </blockquote>

              <figcaption className="mt-6 flex items-center gap-3">
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-[#C4C9D1]/15 font-heading text-sm font-semibold text-[#C4C9D1] ring-1 ring-[#C4C9D1]/20">
                  {initials(testimonial.name)}
                </span>

                <span>
                  <span className="block font-heading text-base font-semibold text-white">
                    {testimonial.name}
                  </span>

                  <span className="block text-xs text-stone-400">
                    {testimonial.role}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}