// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Portfolio (UI) — professional summary
//
// The narrative section: a professional introduction and the areas the worker
// specializes in. Reads only summary fields — bio, tenure, specializations. No HR
// data (no salary, department politics, employee code) ever appears here; this is
// a showcase, not a personnel record.
// ============================================================================

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Section, formatMonthYear } from "./portfolio-ui";
import type { PortfolioSummary } from "./types";

export function ProfessionalSummary({ summary }: { summary: PortfolioSummary }) {
  const hasBio = Boolean(summary.bio?.trim());
  const hasSpecializations = summary.specializations.length > 0;

  return (
    <Section eyebrow="About" title="Professional summary">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {hasBio ? (
          <p className="max-w-2xl text-[15px] leading-relaxed text-gray-700">{summary.bio}</p>
        ) : (
          <p className="text-sm text-gray-400">
            A dedicated professional with {summary.experienceYears}
            {summary.experienceYears === 1 ? " year" : " years"} of hands-on experience.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-400">
          <span>
            Practising since{" "}
            <span className="font-medium text-gray-600">{formatMonthYear(summary.joinDate)}</span>
          </span>
          {summary.experienceYears > 0 && (
            <span>
              <span className="font-medium text-gray-600">{summary.experienceYears}</span>{" "}
              {summary.experienceYears === 1 ? "year" : "years"} of experience
            </span>
          )}
        </div>

        {hasSpecializations && (
          <div className="mt-6 border-t border-gray-100 pt-5">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Sparkles className="size-3.5 text-amber-500" aria-hidden="true" />
              Specializations
            </p>
            <div className="flex flex-wrap gap-2">
              {summary.specializations.map((s) => (
                <span
                  key={s.name}
                  className="inline-flex items-center rounded-full bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200"
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}
