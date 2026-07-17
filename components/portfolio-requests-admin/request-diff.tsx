// ============================================================================
// OWNER  : Gauransh
// MODULE : Branch Admin — Portfolio Requests (current vs requested diff)
//
// Renders a HUMAN-READABLE comparison of the live value (previousValue snapshot)
// against what the worker proposes (payload) — never raw JSON. Colour follows the
// convention the reviewer expects: green = added, red = removed, amber = changed,
// neutral = unchanged. Each request type has its own natural shape (a paragraph, a
// number, a set of chips, or an image), so each is rendered the way it reads best.
// Pure presentational — no state, safe in the client drawer.
// ============================================================================

import * as React from "react";
import Image from "next/image";
import type { PortfolioRequestType } from "@/components/worker-portfolio/request-types";

type Json = Record<string, unknown> | null;

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}
function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function RequestDiff({
  type,
  previous,
  payload,
}: {
  type: PortfolioRequestType;
  previous: Json;
  payload: Record<string, unknown>;
}) {
  switch (type) {
    case "BIO":
      return <TextDiff current={str(previous?.bio)} requested={str(payload.bio)} />;
    case "EXPERIENCE":
      return (
        <ScalarDiff
          current={previous ? `${str(previous.experience)} years` : "—"}
          requested={`${str(payload.experience)} years`}
        />
      );
    case "SKILL":
    case "SKILL_LEVEL":
      return (
        <ScalarDiff
          current={previous?.proficiency != null ? `${str(previous.proficiency)} / 5` : "Not set"}
          requested={`${str(payload.proficiency)} / 5`}
        />
      );
    case "LANGUAGE":
      return <ChipDiff current={arr(previous?.languages)} requested={arr(payload.languages)} />;
    case "CERTIFICATE":
      return <ChipDiff current={arr(previous?.certificates)} requested={arr(payload.certificates)} />;
    case "GALLERY":
      return <GalleryPreview payload={payload} />;
    default:
      return null;
  }
}

/* ─── Panels ─────────────────────────────────────────────────────────────── */

function Panel({ label, children, accent }: { label: string; children: React.ReactNode; accent?: "requested" }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        accent === "requested" ? "border-gray-300 bg-gray-50" : "border-gray-100 bg-white"
      }`}
    >
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      {children}
    </div>
  );
}

function TextDiff({ current, requested }: { current: string; requested: string }) {
  const changed = current.trim() !== requested.trim();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Panel label="Current">
        <p className="whitespace-pre-wrap text-sm text-gray-600">{current || <em className="text-gray-400">Empty</em>}</p>
      </Panel>
      <Panel label="Requested" accent="requested">
        <p className={`whitespace-pre-wrap text-sm ${changed ? "text-amber-800" : "text-gray-600"}`}>
          {requested || <em className="text-gray-400">Empty</em>}
        </p>
      </Panel>
    </div>
  );
}

function ScalarDiff({ current, requested }: { current: string; requested: string }) {
  const changed = current !== requested;
  return (
    <div className="flex items-center gap-3">
      <span className="rounded-lg border border-gray-100 bg-white px-3 py-1.5 text-sm text-gray-600">{current}</span>
      <span aria-hidden="true" className="text-gray-300">→</span>
      <span
        className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
          changed ? "border-amber-200 bg-amber-50 text-amber-800" : "border-gray-100 bg-white text-gray-600"
        }`}
      >
        {requested}
      </span>
    </div>
  );
}

/**
 * Set diff for string arrays: an item only in the request is ADDED (green), only in
 * the current value is REMOVED (red), in both is unchanged (neutral).
 */
function ChipDiff({ current, requested }: { current: string[]; requested: string[] }) {
  const cur = new Set(current);
  const req = new Set(requested);
  const added = requested.filter((x) => !cur.has(x));
  const removed = current.filter((x) => !req.has(x));
  const kept = requested.filter((x) => cur.has(x));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {kept.map((x) => (
          <Chip key={`k-${x}`} tone="neutral">{x}</Chip>
        ))}
        {added.map((x) => (
          <Chip key={`a-${x}`} tone="added">+ {x}</Chip>
        ))}
        {removed.map((x) => (
          <Chip key={`r-${x}`} tone="removed">− {x}</Chip>
        ))}
      </div>
      {added.length === 0 && removed.length === 0 && (
        <p className="text-xs text-gray-400">No changes to the list.</p>
      )}
    </div>
  );
}

function Chip({ tone, children }: { tone: "neutral" | "added" | "removed"; children: React.ReactNode }) {
  const cls =
    tone === "added"
      ? "bg-green-50 text-green-700 ring-green-200"
      : tone === "removed"
        ? "bg-red-50 text-red-600 line-through ring-red-200"
        : "bg-gray-50 text-gray-600 ring-gray-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>
      {children}
    </span>
  );
}

function GalleryPreview({ payload }: { payload: Record<string, unknown> }) {
  const after = str(payload.afterImage);
  const before = str(payload.beforeImage);
  const title = str(payload.title);
  const description = str(payload.description);
  const category = str(payload.category);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {before && (
          <figure className="overflow-hidden rounded-lg border border-gray-200">
            <div className="relative aspect-[4/5] bg-gray-100">
              <Image src={before} alt="Before" fill sizes="200px" className="object-cover" />
            </div>
            <figcaption className="px-2 py-1 text-[10px] uppercase tracking-wide text-gray-400">Before</figcaption>
          </figure>
        )}
        {after && (
          <figure className="overflow-hidden rounded-lg border border-gray-200">
            <div className="relative aspect-[4/5] bg-gray-100">
              <Image src={after} alt="After" fill sizes="200px" className="object-cover" />
            </div>
            <figcaption className="px-2 py-1 text-[10px] uppercase tracking-wide text-gray-400">After</figcaption>
          </figure>
        )}
      </div>
      <dl className="space-y-1 text-xs text-gray-600">
        {category && <div><span className="text-gray-400">Category: </span>{category}</div>}
        {title && <div><span className="text-gray-400">Title: </span>{title}</div>}
        {description && <div><span className="text-gray-400">Description: </span>{description}</div>}
      </dl>
    </div>
  );
}
