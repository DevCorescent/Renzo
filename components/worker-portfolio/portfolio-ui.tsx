// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Portfolio (UI) — shared presentational primitives
//
// Small, reused building blocks: the section heading, the star rating, the
// rating→level wording and the section shell. Kept in one place so every section
// speaks the same visual language and a star never renders two different ways.
// ============================================================================

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Section shell + heading ────────────────────────────────────────────────
 * A quiet, consistent frame for every section: an eyebrow, a title and generous
 * breathing room. The eyebrow is what gives the page its "chaptered", editorial
 * feel rather than a wall of cards.
 */
export function Section({
  eyebrow,
  title,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("scroll-mt-6", className)}>
      <div className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700/80">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-gray-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/* ─── Star rating ────────────────────────────────────────────────────────────
 * Half-precision, amber, and announced to screen readers as a single value so a
 * rating is one utterance ("4.7 out of 5") rather than five separate stars.
 */
export function StarRating({
  value,
  size = 16,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const rounded = Math.round(value * 2) / 2; // nearest half

  return (
    <span
      role="img"
      aria-label={`${value.toFixed(1)} out of 5`}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = rounded >= i ? "full" : rounded >= i - 0.5 ? "half" : "empty";
        return <StarIcon key={i} state={fill} size={size} />;
      })}
    </span>
  );
}

function StarIcon({ state, size }: { state: "full" | "half" | "empty"; size: number }) {
  if (state === "half") {
    return (
      <span className="relative inline-flex" style={{ width: size, height: size }} aria-hidden="true">
        <Star size={size} className="absolute inset-0 text-amber-200" fill="currentColor" />
        <span className="absolute inset-0 overflow-hidden" style={{ width: size / 2 }}>
          <Star size={size} className="text-amber-500" fill="currentColor" />
        </span>
      </span>
    );
  }
  return (
    <Star
      size={size}
      aria-hidden="true"
      className={state === "full" ? "text-amber-500" : "text-amber-200"}
      fill="currentColor"
    />
  );
}

/* ─── Rating / proficiency → level wording ───────────────────────────────────
 * A single source for the level label, so "Expert" means the same thing whether
 * it comes from a 1–5 proficiency or a 0–5 rating.
 */
export function ratingToLevel(value: number): string {
  if (value >= 4.5) return "Master";
  if (value >= 4) return "Expert";
  if (value >= 3) return "Advanced";
  if (value >= 2) return "Proficient";
  if (value > 0) return "Skilled";
  return "New";
}

export function proficiencyToLevel(p: number): string {
  return ["New", "Skilled", "Proficient", "Advanced", "Expert", "Master"][Math.max(0, Math.min(5, p))];
}

/* ─── Empty hint ─────────────────────────────────────────────────────────────
 * A calm, on-brand placeholder — never a blank space and never a raw "no data".
 */
export function EmptyHint({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-white text-gray-300 ring-1 ring-gray-200">
        <Icon className="size-5" />
      </span>
      <p className="mt-3 text-sm font-medium text-gray-700">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

/** ₹ formatting, en-IN, no decimals — the app-wide money convention. */
export function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/** ISO → "Jul 2026", UTC-pinned so a UTC-midnight date never rolls back a day. */
export function formatMonthYear(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** ISO → "12 Jul 2026", UTC-pinned. */
export function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
