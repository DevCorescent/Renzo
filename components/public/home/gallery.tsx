// OWNER: Gauransh | SECTION: Studio gallery (curved perspective strip)
import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { PILL_SOLID } from "./home-ui";
import { MotionReveal } from "./motion";
import { cn } from "@/lib/utils";
import type { GalleryData } from "@/lib/cms/schema";

export function Gallery({ data }: { data: GalleryData }) {
  const images = data.images.filter((image) => !image.hidden);
  const mid = (images.length - 1) / 2;

  return (
    <section className="overflow-hidden bg-stone-950 py-12">
      {/* Curved image band */}
      <MotionReveal className="flex justify-center gap-2.5 px-4 [perspective:1200px]" y={32}>
        {images.map((image, i) => {
          const offset = i - mid;
          return (
            <div
              key={image.id}
              style={{
                transform: `rotateY(${offset * -11}deg) translateZ(-${Math.abs(offset) * 26}px)`,
              }}
              className="relative aspect-[4/5] w-28 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10 sm:w-40 lg:w-52"
            >
              <Image
                src={image.url}
                alt={image.alt}
                fill
                sizes="(max-width: 640px) 30vw, 13rem"
                className="object-cover"
              />
            </div>
          );
        })}
      </MotionReveal>

      <MotionReveal className="mx-auto mt-8 max-w-2xl px-4 text-center">
        <h2 className="font-heading text-4xl font-semibold tracking-tight text-white sm:text-5xl">
          {data.title}
        </h2>
        <p className="mt-4 leading-relaxed text-stone-400">
          {data.paragraph}
        </p>
        <Link
          href={data.cta.href}
          className={cn(buttonVariants({ size: "lg" }), PILL_SOLID, "mt-8")}
        >
          {data.cta.label}
        </Link>
      </MotionReveal>
    </section>
  );
}