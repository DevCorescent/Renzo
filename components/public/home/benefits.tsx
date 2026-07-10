// OWNER: Gauransh | SECTION: Benefits (Because You Deserve the Best)
import { MotionReveal, MotionStagger, MotionItem } from "./motion";
import { BENEFITS } from "./home-data";

export function Benefits() {
  return (
    <section className="bg-stone-950 py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <MotionReveal className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Why choose us</p>
          <h2 className="mt-3 font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Because You
            <br />
            Deserve the Best
          </h2>
        </MotionReveal>

        <MotionStagger className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <MotionItem
              key={benefit.title}
              className="flex flex-col items-center gap-4 bg-stone-950 p-8 text-center sm:p-10"
            >
              <span className="inline-flex size-14 items-center justify-center rounded-full bg-gold text-white shadow-lg shadow-gold/25">
                <benefit.icon className="size-6" />
              </span>
              <h3 className="font-heading text-xl font-bold text-white">{benefit.title}</h3>
              <p className="max-w-xs text-sm leading-relaxed text-stone-400">{benefit.desc}</p>
            </MotionItem>
          ))}
        </MotionStagger>
      </div>
    </section>
  );
}
