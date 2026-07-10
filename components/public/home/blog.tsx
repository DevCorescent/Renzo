// OWNER: Gauransh | SECTION: Editorial / trends (blog cards)
import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { PILL_SOLID, PILL_OUTLINE } from "./home-ui";
import { MotionReveal, MotionStagger, MotionItem } from "./motion";
import { cn } from "@/lib/utils";
import { BLOG_POSTS } from "./home-data";

export function Blog() {
  return (
    <section className="bg-stone-950 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <MotionReveal className="grid gap-8 lg:grid-cols-2 lg:items-end">
          <h2 className="font-heading text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            More Than a Salon,
            <br />
            An Experience
          </h2>
          <div className="space-y-5 lg:pb-2">
            <p className="leading-relaxed text-stone-400">
              Tips, trends and rituals from our stylists — everything you need to look and feel
              your best between visits.
            </p>
            <Link href="/blog" className={cn(buttonVariants({ size: "sm" }), PILL_SOLID, "px-6")}>
              View All
            </Link>
          </div>
        </MotionReveal>

        <MotionStagger className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {BLOG_POSTS.map((post) => (
            <MotionItem
              key={post.title}
              hover
              className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-stone-900/40"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={post.img}
                  alt={post.title}
                  fill
                  sizes="(max-width: 1024px) 50vw, 22rem"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold uppercase tracking-widest text-gold">{post.tag}</span>
                  <span className="text-stone-500">{post.date}</span>
                </div>
                <h3 className="mt-3 flex-1 font-heading text-lg font-bold leading-snug text-white">
                  {post.title}
                </h3>
                <Link
                  href="/blog"
                  aria-label={`Read: ${post.title}`}
                  className={cn(buttonVariants({ size: "sm" }), PILL_OUTLINE, "mt-5 self-start px-5")}
                >
                  Get Started
                </Link>
              </div>
            </MotionItem>
          ))}
        </MotionStagger>
      </div>
    </section>
  );
}
