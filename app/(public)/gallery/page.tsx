import prisma from "@/lib/db";
import Image from "next/image";
import Link from "next/link";
import { ImageIcon } from "lucide-react";

export const metadata = {
  title: "Gallery — Renzo",
  description: "Browse Renzo salon looks, interiors, and before-and-after transformations.",
};

const CATEGORY_LABELS: Record<string, string> = {
  SALON: "Salon",
  BEFORE_AFTER: "Before & After",
  TEAM: "Team",
  INTERIOR: "Interior",
};

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  const items = await prisma.gallery.findMany({
    where: {
      isActive: true,
      ...(category ? { category } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      image: true,
      category: true,
    },
  });

  const categories = await prisma.gallery.findMany({
    where: { isActive: true },
    select: { category: true },
    distinct: ["category"],
    orderBy: { category: "asc" },
  });

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="border-b border-white/5 bg-stone-900/60 py-14 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Gallery</h1>
        <p className="mt-3 text-stone-400">Looks, spaces, and moments from the Renzo studio</p>

        {categories.length > 1 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/gallery"
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                !category
                  ? "bg-amber-500 text-stone-950"
                  : "border border-white/10 text-stone-300 hover:border-white/20"
              }`}
            >
              All
            </Link>
            {categories.map((c) => (
              <Link
                key={c.category}
                href={`/gallery?category=${encodeURIComponent(c.category)}`}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  category === c.category
                    ? "bg-amber-500 text-stone-950"
                    : "border border-white/10 text-stone-300 hover:border-white/20"
                }`}
              >
                {CATEGORY_LABELS[c.category] ?? c.category}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-stone-900/40 px-6 py-20 text-center">
            <ImageIcon className="mx-auto size-10 text-stone-600" />
            <p className="mt-4 text-lg font-medium text-stone-300">Gallery coming soon</p>
            <p className="mt-2 text-sm text-stone-500">
              We&apos;re curating our best work. Meanwhile, book a visit and experience Renzo in person.
            </p>
            <Link
              href="/book"
              className="mt-6 inline-block rounded-full bg-amber-500 px-6 py-2.5 text-sm font-bold text-stone-950 transition hover:bg-amber-400"
            >
              Book now
            </Link>
          </div>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {items.map((item) => (
              <figure
                key={item.id}
                className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-white/8 bg-stone-900"
              >
                <div className="relative aspect-[4/5] w-full bg-stone-800">
                  <Image
                    src={item.image}
                    alt={item.title || CATEGORY_LABELS[item.category] || "Gallery image"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
                {(item.title || item.category) && (
                  <figcaption className="px-3 py-2.5">
                    {item.title && (
                      <p className="text-sm font-medium text-stone-200">{item.title}</p>
                    )}
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-500">
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </p>
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
