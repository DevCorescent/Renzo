// OWNER: Gauransh | SECTION: Studio gallery (curved perspective strip)
import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { PILL_SOLID } from "./home-ui";
import { MotionReveal } from "./motion";
import { cn } from "@/lib/utils";
import { GALLERY } from "./home-data";

export function Gallery() {
  const mid = (GALLERY.length - 1) / 2;

  return (
    <section className="overflow-hidden bg-stone-950 py-24 sm:py-32">
      {/* Curved image band */}
      <MotionReveal className="flex justify-center gap-2.5 px-4 [perspective:1200px]" y={32}>
        {GALLERY.map((image, i) => {
          const offset = i - mid;
          return (
            <div
              key={image.src}
              style={{
                transform: `rotateY(${offset * -11}deg) translateZ(-${Math.abs(offset) * 26}px)`,
              }}
              className="relative aspect-[4/5] w-28 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10 sm:w-40 lg:w-52"
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 640px) 30vw, 13rem"
                className="object-cover"
              />
            </div>
          );
        })}
      </MotionReveal>

      <MotionReveal className="mx-auto mt-14 max-w-2xl px-4 text-center">
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
