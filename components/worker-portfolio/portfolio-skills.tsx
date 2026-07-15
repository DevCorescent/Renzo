// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Portfolio (UI) — skill matrix & services mastered
//
// TWO distinct sections from TWO distinct sources, so neither is padding:
//   • Skill Matrix   — the worker's declared skills + proficiency (WorkerSkill),
//                      surfaced from summary.specializations.
//   • Services Mastered — the services they actually deliver, with a rating
//                      CALCULATED from approved customer reviews (skill-ratings).
// A service with no reviews yet shows an honest "No ratings yet", never a fake star.
// ============================================================================

import * as React from "react";
import { Scissors } from "lucide-react";
import { Section, StarRating, proficiencyToLevel, ratingToLevel } from "./portfolio-ui";
import type { PortfolioSummary, SkillRating } from "./types";

const LEVEL_TONE: Record<string, string> = {
  Master: "bg-amber-50 text-amber-700 ring-amber-200",
  Expert: "bg-amber-50 text-amber-700 ring-amber-200",
  Advanced: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Proficient: "bg-blue-50 text-blue-700 ring-blue-200",
  Skilled: "bg-gray-50 text-gray-600 ring-gray-200",
  New: "bg-gray-50 text-gray-500 ring-gray-200",
};

function LevelPill({ level }: { level: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${
        LEVEL_TONE[level] ?? LEVEL_TONE.Skilled
      }`}
    >
      {level}
    </span>
  );
}

/* ─── Skill Matrix ─────────────────────────────────────────────────────────── */
export function SkillMatrix({ summary }: { summary: PortfolioSummary }) {
  return (
    <Section eyebrow="Craft" title="Skill matrix">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {summary.specializations.map((s) => {
          const level = proficiencyToLevel(s.proficiency);
          return (
            <div
              key={s.name}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-gray-900">{s.name}</p>
                <LevelPill level={level} />
              </div>
              {/* proficiency is 1–5; render as a five-dot strength meter. */}
              <div className="mt-3 flex items-center gap-1" aria-label={`Proficiency ${s.proficiency} of 5`}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      i <= s.proficiency ? "bg-amber-400" : "bg-gray-100"
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ─── Services Mastered ────────────────────────────────────────────────────── */
export function ServicesMastered({ skills }: { skills: SkillRating[] }) {
  return (
    <Section eyebrow="Expertise" title="Services mastered">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map((s) => {
          const rated = s.reviewCount > 0;
          return (
            <div
              key={s.serviceId}
              className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-gray-50 text-gray-400 ring-1 ring-gray-100">
                    <Scissors className="size-4" aria-hidden="true" />
                  </span>
                  <p className="font-medium text-gray-900">{s.serviceName}</p>
                </div>
                {rated && <LevelPill level={ratingToLevel(s.averageRating)} />}
              </div>

              <div className="mt-3 flex items-center justify-between">
                {rated ? (
                  <>
                    <StarRating value={s.averageRating} size={14} />
                    <span className="text-xs text-gray-400">
                      {s.averageRating.toFixed(1)} · {s.reviewCount}{" "}
                      {s.reviewCount === 1 ? "review" : "reviews"}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-gray-400">No ratings yet</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
