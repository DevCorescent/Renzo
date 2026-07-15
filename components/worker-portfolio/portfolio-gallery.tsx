"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Portfolio (UI) — gallery + lightbox
//
// The showcase's centrepiece: approved work, grouped by category, opening into a
// full-screen before/after lightbox. next/image lazy-loads every tile, so a large
// gallery costs nothing until scrolled into view. The lightbox is a native
// <dialog> — focus trap, top layer and Escape for free — with arrow-key paging.
//
// Pending items are still shown to the OWNER of the portfolio (this is their own
// page) but clearly marked "Pending review", so nothing regresses from the old
// table while the public-facing feel stays "approved, premium work".
// ============================================================================

import * as React from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Section } from "./portfolio-ui";
import type { GalleryItem } from "./types";

export function PortfolioGallery({ items }: { items: GalleryItem[] }) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [openIndex, setOpenIndex] = React.useState<number | null>(null);
  const [showBefore, setShowBefore] = React.useState(false);

  const open = openIndex !== null;
  const current = open ? items[openIndex] : null;

  // Group by category, preserving first-seen order, while keeping each tile's
  // GLOBAL index so the lightbox can page across the whole gallery.
  const groups = React.useMemo(() => {
    const map = new Map<string, { item: GalleryItem; index: number }[]>();
    items.forEach((item, index) => {
      const bucket = map.get(item.category) ?? [];
      bucket.push({ item, index });
      map.set(item.category, bucket);
    });
    return [...map.entries()];
  }, [items]);

  const openAt = React.useCallback((index: number) => {
    setShowBefore(false);
    setOpenIndex(index);
  }, []);

  const close = React.useCallback(() => setOpenIndex(null), []);

  const step = React.useCallback(
    (dir: 1 | -1) => {
      setShowBefore(false);
      setOpenIndex((i) => {
        if (i === null) return i;
        return (i + dir + items.length) % items.length;
      });
    },
    [items.length]
  );

  // DOM sync + keyboard paging. No setState fires synchronously in this effect.
  React.useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, step]);

  return (
    <Section eyebrow="Work" title="Portfolio gallery">
      <div className="space-y-6">
        {groups.map(([category, entries]) => (
          <div key={category}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {category}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {entries.map(({ item, index }) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openAt(index)}
                  aria-label={`View ${item.title ?? "portfolio item"}`}
                  className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-gray-100 ring-1 ring-gray-200 transition hover:ring-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                >
                  <Image
                    src={item.afterImage}
                    alt={item.title ?? `${item.category} work`}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8 opacity-0 transition group-hover:opacity-100">
                    {item.title && (
                      <p className="truncate text-xs font-medium text-white">{item.title}</p>
                    )}
                  </div>
                  {item.beforeImage && (
                    <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                      Before / After
                    </span>
                  )}
                  {!item.isApproved && (
                    <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur">
                      <Clock className="size-2.5" aria-hidden="true" />
                      Pending review
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      <dialog
        ref={dialogRef}
        onClose={close}
        onCancel={close}
        onClick={(e) => {
          if (e.target === dialogRef.current) close();
        }}
        aria-label="Portfolio image"
        className="m-0 h-dvh max-h-dvh w-full max-w-full bg-transparent p-0 backdrop:bg-black/80"
      >
        {current && (
          <div className="flex h-full w-full flex-col items-center justify-center p-4 sm:p-8">
            {/* Top bar */}
            <div className="flex w-full max-w-4xl items-center justify-between pb-3 text-white">
              <div className="min-w-0">
                {current.title && <p className="truncate text-sm font-medium">{current.title}</p>}
                <p className="text-xs text-white/50">{current.category}</p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Image stage */}
            <div className="relative flex w-full max-w-4xl flex-1 items-center justify-center">
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous"
                  className="absolute left-0 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  <ChevronLeft className="size-5" />
                </button>
              )}

              <div className="relative h-full max-h-[70vh] w-full">
                <Image
                  key={`${current.id}-${showBefore ? "b" : "a"}`}
                  src={showBefore && current.beforeImage ? current.beforeImage : current.afterImage}
                  alt={current.title ?? `${current.category} work`}
                  fill
                  sizes="100vw"
                  className="object-contain"
                />
              </div>

              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next"
                  className="absolute right-0 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  <ChevronRight className="size-5" />
                </button>
              )}
            </div>

            {/* Before / After toggle + caption */}
            <div className="w-full max-w-4xl pt-3">
              {current.beforeImage && (
                <div className="mb-2 inline-flex rounded-full bg-white/10 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowBefore(true)}
                    className={`rounded-full px-3 py-1 font-medium transition ${
                      showBefore ? "bg-white text-gray-900" : "text-white/70 hover:text-white"
                    }`}
                  >
                    Before
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBefore(false)}
                    className={`rounded-full px-3 py-1 font-medium transition ${
                      !showBefore ? "bg-white text-gray-900" : "text-white/70 hover:text-white"
                    }`}
                  >
                    After
                  </button>
                </div>
              )}
              {current.description && (
                <p className="text-sm leading-relaxed text-white/70">{current.description}</p>
              )}
            </div>
          </div>
        )}
      </dialog>
    </Section>
  );
}
