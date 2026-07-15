// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Portfolio (UI) — certifications
//
// summary.certificates is a String[] of names — the schema stores no issuing
// authority or year, so the cards show the credential name with a professional
// mark and nothing fabricated around it. If the array is empty the parent hides
// the section entirely.
// ============================================================================

import * as React from "react";
import { GraduationCap } from "lucide-react";
import { Section } from "./portfolio-ui";

export function Certifications({ certificates }: { certificates: string[] }) {
  return (
    <Section eyebrow="Credentials" title="Certifications">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {certificates.map((name, i) => (
          <div
            key={`${name}-${i}`}
            className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-linear-to-br from-white to-gray-50/50 p-4 shadow-sm"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
              <GraduationCap className="size-5" aria-hidden="true" />
            </span>
            <p className="min-w-0 text-sm font-medium text-gray-800">{name}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
