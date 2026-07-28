"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Homepage CMS — media library
//
// A searchable index of every image the homepage uses. Uploading still goes
// through the existing <ImageUpload> → /api/v1/upload path; this panel adds the
// authoring layer on top: naming, alt text, categories, preview, soft delete and
// restore.
//
// Deletion is always recoverable — an image is flagged, never dropped, and the
// stored object is left alone so a published page pointing at it keeps working.
// ============================================================================

import * as React from "react";
import Image from "next/image";
import { RotateCcw, Search, Trash2 } from "lucide-react";

import { ImageUpload } from "@/components/shared/image-upload";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@/components/shared/ui";
import { cn } from "@/lib/utils";
import type { MediaItem } from "@/lib/cms/schema";

export function MediaLibraryPanel({
  items,
  onUpload,
  onPatch,
  busy,
}: {
  items: MediaItem[];
  onUpload: (url: string) => void;
  onPatch: (id: string, patch: Partial<Pick<MediaItem, "name" | "alt" | "category" | "deleted">>) => void;
  busy: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [showDeleted, setShowDeleted] = React.useState(false);

  const visible = items.filter((item) => {
    if (!showDeleted && item.deleted) return false;
    if (!query.trim()) return true;
    const haystack = `${item.name} ${item.alt} ${item.category} ${item.url}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  const deletedCount = items.filter((item) => item.deleted).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Media library</CardTitle>
        <Badge tone="neutral">{items.filter((i) => !i.deleted).length} images</Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-xs text-gray-500 dark:text-(--sa-text-2)">
          Upload once, reuse anywhere. Every image uploaded from a section field is indexed here
          automatically.
        </p>

        <ImageUpload label="Upload a new image" value={null} onChange={(url) => url && onUpload(url)} />

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, alt text or category"
              aria-label="Search media library"
              className="w-full rounded border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 outline-none focus:border-gray-500 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)"
            />
          </label>
          {deletedCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDeleted((v) => !v)}
              className="rounded border border-gray-200 px-2.5 py-2 text-[11px] text-gray-600 transition-colors hover:bg-gray-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover)"
            >
              {showDeleted ? "Hide" : "Show"} deleted ({deletedCount})
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <p className="rounded border border-dashed border-gray-200 p-6 text-center text-xs text-gray-400 dark:border-(--sa-border) dark:text-(--sa-muted)">
            {query ? "No images match that search." : "No images indexed yet."}
          </p>
        ) : (
          <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {visible.map((item) => (
              <div
                key={item.id}
                className={cn(
                  "flex gap-3 rounded border border-gray-200 p-2 dark:border-(--sa-border)",
                  item.deleted && "opacity-60"
                )}
              >
                <div className="relative size-16 shrink-0 overflow-hidden rounded bg-gray-50 dark:bg-white/5">
                  <Image src={item.url} alt={item.alt || item.name} fill sizes="64px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    value={item.name}
                    onChange={(e) => onPatch(item.id, { name: e.target.value })}
                    aria-label="Image name"
                    className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium text-gray-900 outline-none hover:border-gray-200 focus:border-gray-400 dark:text-(--sa-text) dark:hover:border-(--sa-border)"
                  />
                  <input
                    value={item.alt}
                    onChange={(e) => onPatch(item.id, { alt: e.target.value })}
                    placeholder="Alt text"
                    aria-label="Alt text"
                    className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-gray-500 outline-none hover:border-gray-200 focus:border-gray-400 dark:text-(--sa-text-2) dark:hover:border-(--sa-border)"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      value={item.category}
                      onChange={(e) => onPatch(item.id, { category: e.target.value })}
                      aria-label="Category"
                      className="w-28 rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-gray-500 outline-none hover:border-gray-200 focus:border-gray-400 dark:text-(--sa-text-2) dark:hover:border-(--sa-border)"
                    />
                    {item.deleted && <Badge tone="danger">Deleted</Badge>}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPatch(item.id, { deleted: !item.deleted })}
                  title={item.deleted ? "Restore image" : "Delete image"}
                  aria-label={item.deleted ? `Restore ${item.name}` : `Delete ${item.name}`}
                  className="inline-flex size-7 shrink-0 items-center justify-center self-start rounded border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover)"
                >
                  {item.deleted ? <RotateCcw className="size-3.5" /> : <Trash2 className="size-3.5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
