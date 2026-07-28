"use client";

import { Disclosure } from "@/components/ui/disclosure";
import type { FaqData } from "@/lib/cms/schema";

export function FaqSection({ data }: { data: FaqData }) {
  return (
    <section className="bg-[#111315] py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#C4C9D1]">{data.eyebrow}</p>
          <h2 className="mt-3 font-heading text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {data.title}
          </h2>
          <p className="mt-4 leading-relaxed text-stone-400">{data.subtitle}</p>
        </div>

        <div className="mt-12 space-y-4">
          {data.items.filter((item) => !item.hidden).map((item) => (
            <Disclosure key={item.id} title={item.question} content={item.answer} />
          ))}
        </div>
      </div>
    </section>
  );
}
