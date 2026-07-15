import { redirect } from "next/navigation";
import { ImageOff, MessageSquare, GraduationCap, AlertTriangle } from "lucide-react";
import { getServerUser } from "@/lib/server-session";
import { apiGet, type Paginated } from "@/lib/api-server";
import { Section, EmptyHint } from "@/components/worker-portfolio/portfolio-ui";
import { PortfolioHero } from "@/components/worker-portfolio/portfolio-hero";
import { ProfessionalSummary } from "@/components/worker-portfolio/portfolio-summary";
import { SkillMatrix, ServicesMastered } from "@/components/worker-portfolio/portfolio-skills";
import { PortfolioGallery } from "@/components/worker-portfolio/portfolio-gallery";
import { Certifications } from "@/components/worker-portfolio/portfolio-credentials";
import { Statistics } from "@/components/worker-portfolio/portfolio-stats";
import { Reviews } from "@/components/worker-portfolio/portfolio-reviews";
import type {
  GalleryItem,
  PortfolioReview,
  PortfolioStatistics,
  PortfolioSummary,
  SkillRating,
} from "@/components/worker-portfolio/types";

// OWNER: Gauransh | MODULE: Worker — Portfolio (professional showcase)
//
// Rebuilt from a plain table into the worker's premium professional identity. It
// consumes ONLY the worker portfolio APIs (never Prisma), fetched once on the
// server and forwarded with the session cookie so RBAC is the API's job.
//
// GRACEFUL BY SECTION. apiGet never throws — each call returns an ApiResult. A
// section whose endpoint FAILED is hidden; a section that is merely EMPTY (no work
// uploaded yet, no reviews) shows a warm empty state instead of a blank gap. The
// page can never crash, and never renders undefined/null.
//
// SECTIONS WITH NO BACKEND ARE OMITTED, NOT FAKED. Achievements, Career Timeline,
// Admin Insights, availability, portfolio views and average service time have no
// endpoint/column, so they do not appear — a fabricated badge would defeat the
// entire point of a trustworthy portfolio. They light up if/when the backend adds
// them; nothing here needs to change first.

export default async function WorkerPortfolioPage() {
  const authUser = await getServerUser();
  if (!authUser?.workerId) redirect("/login");

  // One parallel batch — no waterfalls, no duplicate calls.
  const [summaryRes, statsRes, skillsRes, galleryRes, reviewsRes] = await Promise.all([
    apiGet<PortfolioSummary>("/api/v1/worker/portfolio/summary"),
    apiGet<PortfolioStatistics>("/api/v1/worker/portfolio/statistics"),
    apiGet<SkillRating[]>("/api/v1/worker/portfolio/skill-ratings"),
    apiGet<Paginated<GalleryItem>>("/api/v1/worker/portfolio?limit=100"),
    apiGet<Paginated<PortfolioReview>>("/api/v1/worker/portfolio/reviews?limit=20"),
  ]);

  // The summary is the spine of the page. If even that could not load, we say so
  // calmly rather than render a headless showcase.
  if (!summaryRes.ok) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <EmptyHint
          icon={AlertTriangle}
          title="We couldn't load your portfolio right now"
          hint="Please refresh in a moment. Your work is safe."
        />
      </div>
    );
  }

  const summary = summaryRes.data;
  const skills = skillsRes.ok ? skillsRes.data : [];
  const gallery = galleryRes.ok ? galleryRes.data.items : null; // null = endpoint failed
  const reviews = reviewsRes.ok ? reviewsRes.data.items : null;

  return (
    <div className="mx-auto max-w-5xl space-y-12 pb-16">
      <PortfolioHero summary={summary} />

      <ProfessionalSummary summary={summary} />

      {summary.specializations.length > 0 && <SkillMatrix summary={summary} />}

      {/* Gallery — empty state when the worker has no work yet; hidden only if the
          endpoint itself failed. */}
      {gallery !== null &&
        (gallery.length > 0 ? (
          <PortfolioGallery items={gallery} />
        ) : (
          <Section eyebrow="Work" title="Portfolio gallery">
            <EmptyHint
              icon={ImageOff}
              title="No portfolio yet"
              hint="Upload your best before-and-after work to start building your showcase."
            />
          </Section>
        ))}

      {skills.length > 0 && <ServicesMastered skills={skills} />}

      {/* Certificates — professional placeholder when none are on file. */}
      {summary.certificates.length > 0 ? (
        <Certifications certificates={summary.certificates} />
      ) : (
        <Section eyebrow="Credentials" title="Certifications">
          <EmptyHint
            icon={GraduationCap}
            title="No certifications added yet"
            hint="Certifications you earn will appear here as credentials."
          />
        </Section>
      )}

      {statsRes.ok && <Statistics stats={statsRes.data} />}

      {/* Reviews — friendly message when there are none yet. */}
      {reviews !== null &&
        (reviews.length > 0 ? (
          <Reviews reviews={reviews} />
        ) : (
          <Section eyebrow="Voices" title="Customer reviews">
            <EmptyHint
              icon={MessageSquare}
              title="No reviews yet"
              hint="As customers review your work, their words will appear here."
            />
          </Section>
        ))}
    </div>
  );
}
