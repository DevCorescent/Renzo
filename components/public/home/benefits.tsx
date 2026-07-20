// OWNER: Gauransh | SECTION: Benefits (2026 Premium UI)

import { MotionReveal, MotionStagger, MotionItem } from "./motion";
import { BENEFITS } from "./home-data";

export function Benefits() {
  return (
    <section className="relative overflow-hidden bg-[#111315] py-28">
      <div className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-[#E8E5DE]/10 blur-[140px]" />
      <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[#5F6D7A]/10 blur-[140px]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <MotionReveal className="mx-auto max-w-3xl overflow-x-hidden text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#E8E5DE]">
            Why Choose Us
          </p>

          <h2 className="mt-5 font-heading text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl md:text-4xl">
            Because You <span className="text-[#E8E5DE]">Deserve The Best</span>
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#B8BEC8]">
            Experience premium salon services delivered by expert stylists
            using world-class products in a luxurious and relaxing environment.
          </p>
        </MotionReveal>

        <MotionStagger className="mt-20 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <MotionItem
              key={benefit.title}
              className="
              group
              relative
              overflow-hidden
              rounded-[30px]
              border
              border-[#E8E5DE]/15
              bg-white/[0.04]
              p-10
              shadow-[0_8px_40px_rgba(0,0,0,.25)]
              backdrop-blur-xl
              transition-all
              duration-500
              hover:-translate-y-2
              hover:border-[#E8E5DE]/40
              hover:bg-white/[0.06]
              hover:shadow-[0_20px_60px_rgba(0,0,0,.35)]
              "
            >
              <div className="absolute inset-0 bg-gradient-to-br from-[#E8E5DE]/[0.06] via-transparent to-transparent opacity-100 transition duration-500 group-hover:from-[#E8E5DE]/10" />

              <div className="relative z-10">
                <span
                  className="
                  flex
                  h-16
                  w-16
                  items-center
                  justify-center
                  rounded-2xl
                  bg-[#E8E5DE]/15
                  text-[#E8E5DE]
                  ring-1
                  ring-[#E8E5DE]/20
                  transition-all
                  duration-500
                  group-hover:scale-110
                  group-hover:bg-[#E8E5DE]
                  group-hover:text-black
                  "
                >
                  <benefit.icon className="h-7 w-7" />
                </span>

                <h3 className="mt-8 text-2xl font-bold text-white">
                  {benefit.title}
                </h3>

                <p className="mt-4 leading-7 text-[#B8BEC8]">
                  {benefit.desc}
                </p>
              </div>
            </MotionItem>
          ))}
        </MotionStagger>
      </div>
    </section>
  );
}