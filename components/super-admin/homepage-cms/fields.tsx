"use client";

// ============================================================================
// OWNER  : Gauransh
// MODULE : Homepage CMS — form primitives
//
// Every editable field on the homepage is one of a small number of shapes: text,
// long text, a number, a toggle, a link (label + href), an image, an icon from a
// fixed set, or an ordered collection of any of those. Defining each shape ONCE
// here is what keeps the section forms declarative and free of copy-pasted
// input markup.
//
// Note what is deliberately absent: there is no colour picker, font control,
// spacing control or class-name input anywhere in this file. Authors edit
// content; the design system stays in code.
// ============================================================================

import * as React from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2, Images } from "lucide-react";

import { ImageUpload } from "@/components/shared/image-upload";
import { cn } from "@/lib/utils";
import { ICON_NAMES, type IconName, type ImageRef, type LinkItem, type MediaItem } from "@/lib/cms/schema";
import { cmsIcon } from "@/lib/cms/icons";

const INPUT_CLASS =
  "w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-gray-500 dark:border-(--sa-border) dark:bg-(--sa-surface) dark:text-(--sa-text)";

const LABEL_CLASS = "text-xs font-medium text-gray-600 dark:text-(--sa-text-2)";

/** Stable unique id for a newly added collection item. */
export function newItemId(prefix = "item"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ─── Scalar fields ────────────────────────────────────────────────────────── */

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className={LABEL_CLASS}>{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
      />
      {hint && <span className="block text-[11px] text-gray-400 dark:text-(--sa-muted)">{hint}</span>}
    </label>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
  hint,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className={LABEL_CLASS}>{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className={cn(INPUT_CLASS, "resize-y")}
      />
      {hint && <span className="block text-[11px] text-gray-400 dark:text-(--sa-muted)">{hint}</span>}
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className={LABEL_CLASS}>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          // An empty or half-typed input must not write NaN into the document.
          const next = Number(e.target.value);
          onChange(Number.isFinite(next) ? next : 0);
        }}
        className={INPUT_CLASS}
      />
    </label>
  );
}

export function ToggleField({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2.5 py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 rounded border-gray-300"
      />
      <span>
        <span className="block text-xs font-medium text-gray-700 dark:text-(--sa-text)">{label}</span>
        {hint && <span className="block text-[11px] text-gray-400 dark:text-(--sa-muted)">{hint}</span>}
      </span>
    </label>
  );
}

/** A label + destination pair, edited together because they are one decision. */
export function LinkField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: LinkItem;
  onChange: (value: LinkItem) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        label={`${label} — text`}
        value={value.label}
        onChange={(next) => onChange({ ...value, label: next })}
      />
      <TextField
        label={`${label} — link`}
        value={value.href}
        onChange={(next) => onChange({ ...value, href: next })}
        placeholder="/book"
      />
    </div>
  );
}

/**
 * Icons come from a fixed whitelist so an author can never type a name that
 * fails to render. The current choice is previewed beside the select.
 */
export function IconField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: IconName;
  onChange: (value: IconName) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className={LABEL_CLASS}>{label}</span>
      <div className="flex items-center gap-2">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded border border-gray-200 text-gray-600 dark:border-(--sa-border) dark:text-(--sa-text)">
          {/* createElement rather than binding the resolved icon to a capitalised
              local: the latter reads as defining a component during render, which
              remounts the subtree on every keystroke. */}
          {React.createElement(cmsIcon(value), { className: "size-4" })}
        </span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as IconName)}
          className={INPUT_CLASS}
        >
          {ICON_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

/* ─── Image field ──────────────────────────────────────────────────────────── */

/**
 * Upload, replace, clear, preview and alt text for one image slot, plus reuse of
 * anything already in the media library.
 *
 * Uploading is delegated to the existing <ImageUpload>, which posts to the
 * existing /api/v1/upload route — no second upload path is introduced here. Once
 * a URL comes back it is also indexed in the media library via `onIndexed`, so
 * every image used anywhere on the homepage is discoverable and reusable.
 */
export function ImageField({
  label,
  value,
  onChange,
  library,
  onIndexed,
  category,
}: {
  label: string;
  value: ImageRef;
  onChange: (value: ImageRef) => void;
  library: MediaItem[];
  onIndexed: (url: string, category: string) => void;
  category: string;
}) {
  const [picking, setPicking] = React.useState(false);
  const available = library.filter((item) => !item.deleted);

  return (
    <div className="space-y-2 rounded border border-gray-200 p-3 dark:border-(--sa-border)">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-700 dark:text-(--sa-text)">{label}</span>
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-600 transition-colors hover:bg-gray-50 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover)"
        >
          <Images className="size-3" />
          {picking ? "Close library" : "Choose from library"}
        </button>
      </div>

      <ImageUpload
        label=""
        value={value.url || null}
        onChange={(url) => {
          onChange({ ...value, url: url ?? "" });
          if (url) onIndexed(url, category);
        }}
      />

      {picking && (
        <div className="max-h-56 overflow-y-auto rounded border border-gray-200 p-2 dark:border-(--sa-border)">
          {available.length === 0 ? (
            <p className="p-2 text-xs text-gray-400 dark:text-(--sa-muted)">
              Nothing in the library yet — upload an image to add one.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {available.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.name}
                  onClick={() => {
                    onChange({ ...value, url: item.url, alt: value.alt || item.alt });
                    setPicking(false);
                  }}
                  className={cn(
                    "relative aspect-square overflow-hidden rounded border transition-colors",
                    item.url === value.url
                      ? "border-gray-900 dark:border-white"
                      : "border-gray-200 hover:border-gray-400 dark:border-(--sa-border)"
                  )}
                >
                  <Image src={item.url} alt={item.alt || item.name} fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <TextField
        label="Alt text (describes the image for screen readers)"
        value={value.alt}
        onChange={(alt) => onChange({ ...value, alt })}
      />
    </div>
  );
}

/* ─── Repeatable collections ───────────────────────────────────────────────── */

/**
 * Add / edit / delete / reorder / hide for any list of items.
 *
 * "Hide" is offered separately from "delete" wherever the underlying item
 * supports it: taking a card off the page is usually temporary, and an author
 * should not have to destroy the copy to do it.
 */
export function RepeatableList<T extends { id: string }>({
  title,
  items,
  onChange,
  createItem,
  renderItem,
  isHidden,
  onToggleHidden,
  itemLabel,
  max,
}: {
  title: string;
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void, index: number) => React.ReactNode;
  isHidden?: (item: T) => boolean;
  onToggleHidden?: (item: T) => T;
  itemLabel: (item: T, index: number) => string;
  max?: number;
}) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const patchAt = (index: number, patch: Partial<T>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const atMax = max !== undefined && items.length >= max;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-(--sa-text-2)">
          {title} <span className="font-normal normal-case tracking-normal">({items.length})</span>
        </h4>
        <button
          type="button"
          disabled={atMax}
          onClick={() => onChange([...items, createItem()])}
          className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-(--sa-border) dark:text-(--sa-text) dark:hover:bg-(--sa-hover)"
        >
          <Plus className="size-3" />
          Add
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400 dark:border-(--sa-border) dark:text-(--sa-muted)">
          No items yet.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => {
            const hidden = isHidden?.(item) ?? false;
            return (
              <div
                key={item.id}
                className={cn(
                  "rounded border border-gray-200 p-3 dark:border-(--sa-border)",
                  hidden && "opacity-60"
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium text-gray-700 dark:text-(--sa-text)">
                    {itemLabel(item, index) || `Item ${index + 1}`}
                    {hidden && (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-normal text-gray-500 dark:bg-white/10 dark:text-(--sa-text-2)">
                        Hidden
                      </span>
                    )}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton
                      label="Move up"
                      disabled={index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowUp className="size-3.5" />
                    </IconButton>
                    <IconButton
                      label="Move down"
                      disabled={index === items.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowDown className="size-3.5" />
                    </IconButton>
                    {onToggleHidden && (
                      <IconButton
                        label={hidden ? "Show on page" : "Hide from page"}
                        onClick={() =>
                          onChange(items.map((it, i) => (i === index ? onToggleHidden(it) : it)))
                        }
                      >
                        {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </IconButton>
                    )}
                    <IconButton
                      label="Delete"
                      destructive
                      onClick={() => onChange(items.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  </div>
                </div>
                {renderItem(item, (patch) => patchAt(index, patch), index)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  destructive,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-(--sa-border) dark:text-(--sa-text-2) dark:hover:bg-(--sa-hover)",
        destructive && "hover:border-red-200 hover:bg-red-50 hover:text-red-600"
      )}
    >
      {children}
    </button>
  );
}
