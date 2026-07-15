// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Portfolio (UI) — customer reviews
//
// Approved reviews only (the endpoint already filters), shown as luxury quote
// cards: rating, the words, the service, the customer's first name and the date.
// Customer surnames and contact details are never in the payload, so they can
// never leak here.
// ============================================================================

import * as React from "react";
import { Section, StarRating, formatDate } from "./portfolio-ui";
import type { PortfolioReview } from "./types";

export function Reviews({ reviews }: { reviews: PortfolioReview[] }) {
  return (
    <Section eyebrow="Voices" title="Customer reviews">
      <div className="grid gap-4 sm:grid-cols-2">
        {reviews.map((r) => (
          <figure
            key={r.id}
            className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <StarRating value={r.overallRating} size={15} />
              {r.serviceName && (
                <span className="rounded-full bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-500 ring-1 ring-inset ring-gray-200">
                  {r.serviceName}
                </span>
              )}
            </div>

            {r.comment ? (
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-gray-700">
                &ldquo;{r.comment}&rdquo;
              </blockquote>
            ) : (
              <p className="mt-3 flex-1 text-sm italic text-gray-400">No written comment.</p>
            )}

            {r.adminReply && (
              <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                <span className="font-medium text-gray-600">Salon response:</span> {r.adminReply}
              </p>
            )}

            <figcaption className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs">
              <span className="font-medium text-gray-700">{r.customer.firstName}</span>
              <span className="text-gray-400">{formatDate(r.createdAt)}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
