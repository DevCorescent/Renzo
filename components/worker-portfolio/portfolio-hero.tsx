// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Portfolio (UI) — hero
//
// The first impression: a dark, editorial header that answers "who is this
// professional and are they any good?" at a glance — photo, name, title, tenure,
// languages and the headline rating. Server component; purely presentational.
//
// Only fields the summary endpoint actually returns are shown. There is no branch
// or availability in that payload, so neither is rendered (department stands in
// for the affiliation line). Nothing is invented to fill the space.
// ============================================================================

import * as React from "react";
import Image from "next/image";
import { Languages, Briefcase } from "lucide-react";
import { StarRating } from "./portfolio-ui";
import type { PortfolioSummary } from "./types";

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "—"
  );
}

export function PortfolioHero({ summary }: { summary: PortfolioSummary }) {
  const hasRating = summary.totalReviews > 0;

  return (
    <header className="overflow-hidden rounded-3xl bg-linear-to-br from-gray-900 to-gray-950 p-6 text-white shadow-xl ring-1 ring-white/10 sm:p-8">
      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        {/* Photo */}
        <div className="relative shrink-0">
          {summary.profilePhoto ? (
            <Image
              src={summary.profilePhoto}
              alt={summary.name}
              width={132}
              height={132}
              className="size-32 rounded-2xl object-cover ring-2 ring-white/15 sm:size-33"
              priority
            />
          ) : (
            <span className="flex size-32 items-center justify-center rounded-2xl bg-white/5 text-3xl font-semibold text-white/70 ring-2 ring-white/15 sm:size-33">
              {initials(summary.name)}
            </span>
          )}
        </div>

        {/* Identity */}
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{summary.name}</h1>

          {(summary.title || summary.department) && (
            <p className="mt-1 text-sm text-amber-300/90">
              {summary.title}
              {summary.title && summary.department && (
                <span className="text-white/30"> · </span>
              )}
              {summary.department && <span className="text-white/70">{summary.department}</span>}
            </p>
          )}

          {/* Meta row */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/70 sm:justify-start">
            {summary.experienceYears > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Briefcase className="size-3.5 text-white/40" aria-hidden="true" />
                {summary.experienceYears} {summary.experienceYears === 1 ? "year" : "years"} experience
              </span>
            )}
            {summary.languages.length > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Languages className="size-3.5 text-white/40" aria-hidden="true" />
                {summary.languages.join(", ")}
              </span>
            )}
          </div>

          {/* Rating */}
          {hasRating && (
            <div className="mt-5 inline-flex items-center gap-3 rounded-full bg-white/5 px-4 py-2 ring-1 ring-white/10">
              <span className="text-xl font-semibold text-amber-300">
                {summary.averageRating.toFixed(1)}
              </span>
              <StarRating value={summary.averageRating} size={16} />
              <span className="text-xs text-white/50">
                {summary.totalReviews} {summary.totalReviews === 1 ? "review" : "reviews"}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
