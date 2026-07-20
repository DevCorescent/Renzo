"use client";

// OWNER: Gauransh | SECTION: Editorial / trends (blog cards) — 2026 bento + spotlight redesign
import { useRef, type ReactNode, type MouseEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { PILL_SOLID } from "./home-ui";
import { MotionReveal, MotionStagger, MotionItem } from "./motion";
import { cn } from "@/lib/utils";
import { BLOG_POSTS } from "./home-data";

const TICKER_ITEMS = ["Hair Care", "Skin Rituals", "Colour Trends", "Bridal Prep", "Styling Tips"];

function SpotlightCard({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--x", `${e.clientX - rect.left}px`);
    ref.current.style.setProperty("--y", `${e.clientY - rect.top}px`);
  }

  return (
    <div ref={ref} onMouseMove={handleMove} className={cn("relative", className)}>
      {!reduce && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(280px circle at var(--x, 50%) var(--y, 50%), rgba(196,201,209,.16), transparent 70%)",
          }}
        />
      )}
      {children}
    </div>
  );
}

export function Blog() {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-[#0A0B0D] py-24 sm:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-0 size-[32rem] rounded-full bg-[#C4C9D1]/[0.06] blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Category ticker — ties section to Hero's marquee language */}
        <div className="mb-10 overflow-hidden border-y border-white/10 py-3">
          <motion.div
            animate={reduce ? undefined : { x: ["0%", "-50%"] }}
            transition={reduce ? undefined : { duration: 22, repeat: Infinity, ease: "linear" }}
            className="flex shrink-0 items-center gap-6"
          >
            {[...TICKER_ITEMS, ...TICKER_ITEMS, ...TICKER_ITEMS].map((label, i) => (
              <span
                key={label + i}
                className="flex items-center gap-6 whitespace-nowrap text-xs uppercase tracking-[0.22em] text-white/40"
              >
                {label}
                <span aria-hidden className="text-[#C4C9D1]/70">
                  •
                </span>
              </span>
            ))}
          </motion.div>
        </div>

        <MotionReveal className="grid gap-8 lg:grid-cols-2 lg:items-end">
          <div className="min-w-0">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-4 py-1.5 backdrop-blur-xl">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C4C9D1]">
                Journal
              </span>
            </div>
            <h2 className="group max-w-xl font-heading text-4xl font-semibold leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl xl:text-6xl">
              Our Latest{" "}
              <motion.span
                className="inline-block bg-[length:200%_100%] bg-gradient-to-r from-[#F2F2F2] via-[#9AA0AA] to-white bg-clip-text text-transparent transition-transform duration-500 group-hover:translate-x-1.5"
                animate={
                  reduce
                    ? undefined
                    : { backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }
                }
                transition={
                  reduce
                    ? undefined
                    : { duration: 4, repeat: Infinity, ease: "linear" }
                }
              >
                Stories
              </motion.span>
            </h2>
          </div>
          <div className="space-y-5 lg:pb-2">
            <p className="max-w-md leading-relaxed text-[#B7BEC8]">
              Tips, trends and rituals from our stylists — everything you need to look and feel
              your best between visits.
            </p>
            <Link
              href="/blog"
              className={cn(
                buttonVariants({ size: "sm" }),
                PILL_SOLID,
                "group inline-flex items-center gap-2 px-6"
              )}
            >
              View All
              <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
          </div>
        </MotionReveal>

        {/* Bento grid — first post featured, rest fill remaining cells */}
        <MotionStagger className="mt-14 grid auto-rows-[1fr] gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
          {BLOG_POSTS.map((post, i) => {
            const featured = i === 0;
            return (
              <MotionItem
                key={post.title}
                hover
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] backdrop-blur-sm transition-all duration-300 hover:border-[#C4C9D1]/30 hover:shadow-[0_25px_70px_-20px_rgba(196,201,209,.25)]",
                  featured && "sm:col-span-2 lg:col-span-2 lg:row-span-2"
                )}
              >
                <SpotlightCard className="flex h-full flex-col">
                  {/* Index number — bento signature detail */}
                  <span
                    aria-hidden
                    className="absolute left-5 top-5 z-20 font-heading text-xs font-bold tracking-widest text-white/40"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <div
                    className={cn(
                      "relative overflow-hidden",
                      featured ? "aspect-[16/9] lg:aspect-[16/10]" : "aspect-[16/10]"
                    )}
                  >
                    <Image
                      src={post.img}
                      alt={post.title}
                      fill
                      sizes={
                        featured
                          ? "(max-width: 1024px) 100vw, 50vw"
                          : "(max-width: 1024px) 50vw, 22rem"
                      }
                      className="object-cover saturate-[0.85] brightness-[0.9] contrast-[1.05] transition-transform duration-700 group-hover:scale-[1.06]"
                    />
                    {/* Uniform tone wash — brings every image to the same warm-dark
                        register regardless of its original exposure/saturation, so a
                        bright/warm photo (e.g. the nails shot) no longer stands out
                        against the moodier portrait and interior shots beside it. */}
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-[#0A0B0D]/25 mix-blend-multiply"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0B0D]/85 via-[#0A0B0D]/10 to-transparent" />
                  </div>

                  <div className="relative z-20 flex flex-1 flex-col p-6 sm:p-7">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-semibold uppercase tracking-widest text-[#C4C9D1]">
                        {post.tag}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-white/20" aria-hidden />
                      <span className="text-[#8D96A0]">{post.date}</span>
                    </div>

                    <h3
                      className={cn(
                        "mt-3 flex-1 font-heading font-bold leading-snug text-white",
                        featured ? "text-2xl sm:text-3xl" : "text-lg"
                      )}
                    >
                      {post.title}
                    </h3>

                    <Link
                      href="/blog"
                      aria-label={`Read: ${post.title}`}
                      className="mt-5 inline-flex items-center gap-2 self-start text-sm font-medium text-white transition-colors duration-300 hover:text-[#C4C9D1]"
                    >
                      <span className="relative">
                        Read Article
                        <span className="absolute inset-x-0 -bottom-1 h-px scale-x-0 bg-[#C4C9D1] transition-transform duration-300 origin-left group-hover:scale-x-100" />
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </Link>
                  </div>
                </SpotlightCard>
              </MotionItem>
            );
          })}
        </MotionStagger>
      </div>
    </section>
  );
}