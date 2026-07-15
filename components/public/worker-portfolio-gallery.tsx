"use client";

// OWNER: Gauransh | MODULE: Public Worker Portfolio — before/after gallery
//
// A grid of approved portfolio work. Where a before image exists, the card flips
// between After and Before on click (and Enter/Space) — a lightweight, accessible
// reveal that needs no modal. next/image lazy-loads every tile. Dark monochrome to
// match the public site; no amber, no gradients.

import * as React from "react";
import Image from "next/image";

type GalleryItem = {
  id: string;
  category: string;
  title: string | null;
  description: string | null;
  beforeImage: string | null;
  afterImage: string;
};

function Tile({ item }: { item: GalleryItem }) {
  const [showBefore, setShowBefore] = React.useState(false);
  const hasBefore = Boolean(item.beforeImage);
  const src = showBefore && item.beforeImage ? item.beforeImage : item.afterImage;

  return (
    <figure className="overflow-hidden rounded-2xl border border-white/8 bg-stone-900">
      <button
        type="button"
        disabled={!hasBefore}
        onClick={() => setShowBefore((v) => !v)}
        aria-label={hasBefore ? `Toggle before and after for ${item.title ?? item.category}` : undefined}
        className="relative block aspect-4/5 w-full overflow-hidden bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-default"
      >
        <Image
          src={src}
          alt={item.title ?? `${item.category} work`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover"
        />
        {hasBefore && (
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            {showBefore ? "Before" : "After"}
          </span>
        )}
      </button>
      {(item.title || item.category) && (
        <figcaption className="px-3 py-2">
          {item.title && <p className="truncate text-xs font-medium text-stone-200">{item.title}</p>}
          <p className="text-[10px] uppercase tracking-wide text-stone-500">{item.category}</p>
        </figcaption>
      )}
    </figure>
  );
}

export function WorkerPortfolioGallery({ items }: { items: GalleryItem[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => (
        <Tile key={item.id} item={item} />
      ))}
    </div>
  );
}
