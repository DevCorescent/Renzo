import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  Star, ChevronLeft, Award, CheckCircle2, Languages, GraduationCap, Scissors, Quote,
} from "lucide-react";
import { apiGet, type Paginated } from "@/lib/api-server";
import { API } from "@/lib/endpoints";
import { WorkerPortfolioGallery } from "@/components/public/worker-portfolio-gallery";

// OWNER: Devanshi | MODULE: Single Stylist Profile
//
// The public worker PORTFOLIO — a read-only professional showcase for customers,
// branch admins and super admins to judge a worker before booking. It consumes the
// existing public worker + reviews endpoints only; every section renders solely
// from what the backend returns and hides itself when that data is absent (no
// awards / verified badge / success-rate fields exist, so those are never shown).
// No personal/employment data (DOB, phone) appears here — that lives on the Profile.

type WorkerDetail = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  bio: string | null;
  profilePhoto: string | null;
  experience: number;
  languages: string[];
  certificates: string[];
  designation: { name: string; level: number } | null;
  skills: { skill: { name: string }; proficiency: number }[];
  portfolios: {
    id: string;
    category: string;
    title: string | null;
    description: string | null;
    beforeImage: string | null;
    afterImage: string;
  }[];
  services: { id: string; name: string; slug: string; duration: number; basePrice: number }[];
  completedServices: number;
  averageRating: number;
  reviewCount: number;
  ratingDistribution: Record<"1" | "2" | "3" | "4" | "5", number>;
};

type WorkerReview = {
  id: string;
  overallRating: number;
  comment: string | null;
  createdAt: string;
  customer: { firstName: string } | null;
};

function workerName(w: WorkerDetail): string {
  return w.displayName?.trim() || `${w.firstName} ${w.lastName}`.trim();
}

function Stars({ value, className = "size-4" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${className} ${i <= Math.round(value) ? "fill-stone-100 text-stone-100" : "text-stone-700"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
      {children}
    </h2>
  );
}

function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

const LEVELS = ["New", "Skilled", "Proficient", "Advanced", "Expert", "Master"];

export default async function StylistProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [detailRes, reviewsRes] = await Promise.all([
    apiGet<WorkerDetail>(API.public.worker(slug)),
    apiGet<Paginated<WorkerReview>>(`${API.public.workerReviews(slug)}?limit=10`),
  ]);

  if (!detailRes.ok) notFound();
  const w = detailRes.data;
  const reviews = reviewsRes.ok ? reviewsRes.data.items : [];
  const total = w.reviewCount;

  const topSkills = [...w.skills].sort((a, b) => b.proficiency - a.proficiency);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-stone-100 sm:px-6">
      <Link
        href="/stylists"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-300"
      >
        <ChevronLeft className="size-4" /> All workers
      </Link>

      {/* Hero */}
      <header className="rounded-3xl border border-white/8 bg-stone-900 p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div className="relative size-28 shrink-0 overflow-hidden rounded-2xl bg-stone-800 ring-1 ring-white/10">
            {w.profilePhoto ? (
              <Image src={w.profilePhoto} alt={workerName(w)} fill className="object-cover" sizes="112px" priority />
            ) : (
              <div className="flex size-full items-center justify-center text-3xl font-bold text-stone-600">
                {w.firstName[0]}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{workerName(w)}</h1>
            {w.designation?.name && <p className="mt-1 text-sm text-stone-400">{w.designation.name}</p>}

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-stone-400 sm:justify-start">
              {w.experience > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Award className="size-3.5 text-stone-500" aria-hidden="true" />
                  {w.experience} {w.experience === 1 ? "year" : "years"} experience
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-400" aria-hidden="true" />
                {w.completedServices} completed
              </span>
            </div>

            {total > 0 && (
              <div className="mt-5 inline-flex items-center gap-3 rounded-full bg-white/5 px-4 py-2 ring-1 ring-white/10">
                <span className="text-lg font-semibold">{w.averageRating.toFixed(1)}</span>
                <Stars value={w.averageRating} className="size-4" />
                <span className="text-xs text-stone-500">
                  {total} {total === 1 ? "review" : "reviews"}
                </span>
              </div>
            )}

            <div className="mt-5">
              <Link
                href="/book"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-2.5 text-sm font-bold text-stone-950 transition hover:bg-stone-200"
              >
                Book with {w.firstName}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mt-10 space-y-10">
        {/* Bio */}
        {w.bio?.trim() && (
          <section>
            <SectionHeading>About</SectionHeading>
            <p className="max-w-2xl text-[15px] leading-relaxed text-stone-300">{w.bio}</p>
          </section>
        )}

        {/* Skills */}
        {topSkills.length > 0 && (
          <section>
            <SectionHeading>Skills &amp; specializations</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topSkills.map((s) => (
                <div key={s.skill.name} className="rounded-2xl border border-white/8 bg-stone-900 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-stone-100">{s.skill.name}</p>
                    <span className="text-[11px] text-stone-500">{LEVELS[Math.max(0, Math.min(5, s.proficiency))]}</span>
                  </div>
                  <div className="mt-2.5 flex items-center gap-1" aria-label={`Proficiency ${s.proficiency} of 5`}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${i <= s.proficiency ? "bg-stone-200" : "bg-stone-800"}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Services offered */}
        {w.services.length > 0 && (
          <section>
            <SectionHeading>Services offered</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {w.services.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-2xl border border-white/8 bg-stone-900 p-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-800 text-stone-400">
                      <Scissors className="size-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-stone-100">{s.name}</p>
                      <p className="text-xs text-stone-500">{s.duration} min</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-stone-200">
                    ₹{Math.round(s.basePrice).toLocaleString("en-IN")}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Certificates */}
        {w.certificates.length > 0 && (
          <section>
            <SectionHeading>Certifications</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {w.certificates.map((c, i) => (
                <div key={`${c}-${i}`} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-stone-900 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-stone-800 text-stone-300">
                    <GraduationCap className="size-5" aria-hidden="true" />
                  </span>
                  <p className="min-w-0 text-sm font-medium text-stone-200">{c}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Languages */}
        {w.languages.length > 0 && (
          <section>
            <SectionHeading>Languages</SectionHeading>
            <div className="flex flex-wrap gap-2">
              {w.languages.map((l) => (
                <span key={l} className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-stone-300 ring-1 ring-inset ring-white/8">
                  <Languages className="size-3 text-stone-500" aria-hidden="true" />
                  {l}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Before / After gallery */}
        {w.portfolios.length > 0 && (
          <section>
            <SectionHeading>Portfolio work</SectionHeading>
            <WorkerPortfolioGallery items={w.portfolios} />
          </section>
        )}

        {/* Rating distribution */}
        {total > 0 && (
          <section>
            <SectionHeading>Ratings</SectionHeading>
            <div className="max-w-md space-y-1.5">
              {([5, 4, 3, 2, 1] as const).map((n) => {
                const count = w.ratingDistribution[String(n) as "1" | "2" | "3" | "4" | "5"] ?? 0;
                const pct = total ? (count / total) * 100 : 0;
                return (
                  <div key={n} className="flex items-center gap-3">
                    <span className="w-8 text-xs text-stone-500">{n} ★</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-800">
                      <div className="h-full rounded-full bg-stone-300" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-xs text-stone-500">{count}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section>
            <SectionHeading>Customer reviews</SectionHeading>
            <div className="grid gap-4 sm:grid-cols-2">
              {reviews.map((r) => (
                <figure key={r.id} className="rounded-2xl border border-white/8 bg-stone-900 p-5">
                  <div className="flex items-center justify-between">
                    <Stars value={r.overallRating} className="size-3.5" />
                    <span className="text-xs text-stone-500">{formatDate(r.createdAt)}</span>
                  </div>
                  {r.comment ? (
                    <blockquote className="mt-3 flex gap-2 text-sm leading-relaxed text-stone-300">
                      <Quote className="size-4 shrink-0 text-stone-600" aria-hidden="true" />
                      {r.comment}
                    </blockquote>
                  ) : (
                    <p className="mt-3 text-sm italic text-stone-600">No written comment.</p>
                  )}
                  <figcaption className="mt-4 border-t border-white/8 pt-3 text-xs font-medium text-stone-400">
                    {r.customer?.firstName ?? "Guest"}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
