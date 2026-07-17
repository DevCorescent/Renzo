"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { API } from "@/lib/endpoints";
import {
  MapPin, Scissors, Clock, ChevronLeft, ChevronRight, Check,
  Loader2, CalendarDays, X, Star, User, Award, Users,
} from "lucide-react";
import { BookingSuggestTips } from "@/components/ai/booking-suggest-tips";

/* ── shared types (exported for use in server page) ────────────────────────── */

export type PreloadedBranch = {
  id: string; name: string; slug: string; city: string;
  address: string; coverImage: string | null;
};
export type PreloadedService = {
  id: string; name: string; image: string | null;
  duration: number; gender: string; basePrice: number;
  category: { name: string }; price: number;
};

type ApiBranch = PreloadedBranch;
type ApiService = {
  id: string; name: string; image: string | null;
  duration: number; gender: string; basePrice: number;
  category: { name: string }; branchPricings?: { price: number }[];
};

/** A worker qualified for the chosen service at the chosen branch. */
export type ApiWorker = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  bio: string | null;
  profilePhoto: string | null;
  experience: number;
  // Both are already returned by GET /public/workers — surfaced on the card so a
  // customer can judge fit at a glance, never fetched again.
  languages: string[];
  skills: { skill: { name: string }; proficiency: number }[];
  designation: { name: string; level: number } | null;
  averageRating: number;
  reviewCount: number;
  availableToday: boolean | null;
  nextSlot: string | null;
};

type WorkerDetail = ApiWorker & {
  completedServices: number;
  services: { id: string; name: string; duration: number }[];
  ratingDistribution: Record<"1" | "2" | "3" | "4" | "5", number>;
};

type WorkerReview = {
  id: string;
  overallRating: number;
  comment: string | null;
  createdAt: string;
  customer: { firstName: string } | null;
};

function workerName(w: { firstName: string; lastName: string; displayName: string | null }) {
  return w.displayName?.trim() || `${w.firstName} ${w.lastName}`.trim();
}

/* ── helpers ────────────────────────────────────────────────────────────────── */

function today() { return new Date().toISOString().slice(0, 10); }
function addDays(base: string, n: number) {
  const d = new Date(base); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function endTime(start: string, mins: number) {
  const [h, m] = start.split(":").map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

const DATE_COUNT = 14;

/* ── top booking bar: shows selections made so far ──────────────────────────── */

function BookingBar({
  branch, service, worker, workerChosen, date, slot,
  onChangeBranch, onChangeService, onChangeWorker, onChangeSlot,
}: {
  branch: PreloadedBranch | null;
  service: PreloadedService | null;
  worker: ApiWorker | null;
  workerChosen: boolean;
  date: string; slot: string;
  onChangeBranch: () => void;
  onChangeService: () => void;
  onChangeWorker: () => void;
  onChangeSlot: () => void;
}) {
  if (!branch && !service) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-white/8 bg-stone-900/80 p-3">
      {branch && (
        <button
          onClick={onChangeBranch}
          className="group flex items-center gap-2 rounded-xl bg-stone-800 px-3 py-2 text-left transition hover:bg-stone-700"
        >
          <MapPin className="size-3.5 shrink-0 text-stone-400" />
          <span className="text-xs font-medium text-stone-200">{branch.name}</span>
          <X className="size-3 text-stone-600 group-hover:text-red-400 transition" />
        </button>
      )}
      {service && (
        <button
          onClick={onChangeService}
          className="group flex items-center gap-2 rounded-xl bg-stone-800 px-3 py-2 text-left transition hover:bg-stone-700"
        >
          <Scissors className="size-3.5 shrink-0 text-stone-400" />
          <span className="text-xs font-medium text-stone-200">{service.name}</span>
          <span className="text-xs font-semibold text-stone-100">₹{service.price.toLocaleString("en-IN")}</span>
          <X className="size-3 text-stone-600 group-hover:text-red-400 transition" />
        </button>
      )}
      {workerChosen && (
        <button
          onClick={onChangeWorker}
          className="group flex items-center gap-2 rounded-xl bg-stone-800 px-3 py-2 text-left transition hover:bg-stone-700"
        >
          <User className="size-3.5 shrink-0 text-stone-400" />
          <span className="text-xs font-medium text-stone-200">
            {worker ? workerName(worker) : "Any worker"}
          </span>
          <X className="size-3 text-stone-600 group-hover:text-red-400 transition" />
        </button>
      )}
      {slot && (
        <button
          onClick={onChangeSlot}
          className="group flex items-center gap-2 rounded-xl bg-stone-800 px-3 py-2 text-left transition hover:bg-stone-700"
        >
          <Clock className="size-3.5 shrink-0 text-stone-400" />
          <span className="text-xs font-medium text-stone-200">{fmtDate(date).split(",")[0]}, {slot}</span>
          <X className="size-3 text-stone-600 group-hover:text-red-400 transition" />
        </button>
      )}
    </div>
  );
}

/* ── stars ──────────────────────────────────────────────────────────────────── */

function Stars({ value, className = "size-3.5" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${className} ${i <= Math.round(value) ? "fill-stone-100 text-stone-100" : "text-stone-700"}`}
        />
      ))}
    </span>
  );
}

/* ── step indicator ─────────────────────────────────────────────────────────── */

type Step = "branch" | "service" | "worker" | "slot" | "confirm";
const STEPS: { key: Step; label: string }[] = [
  { key: "branch", label: "Branch" },
  { key: "service", label: "Service" },
  { key: "worker", label: "Worker" },
  { key: "slot", label: "Date & Time" },
  { key: "confirm", label: "Confirm" },
];

function StepBar({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="mb-8 flex items-center gap-1">
      {STEPS.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className="flex items-center gap-1.5">
            {/* Completed → green check. Current → filled (white on this dark
                shell, the dark-mode reading of the spec's "black filled"). Upcoming
                → outlined gray. */}
            <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              i < idx ? "bg-emerald-500 text-white" :
              i === idx ? "bg-white text-stone-950" :
              "bg-transparent text-stone-500 ring-1 ring-stone-700"
            }`}>
              {i < idx ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={`hidden text-xs font-medium sm:inline ${
              i === idx ? "text-stone-100" : i < idx ? "text-emerald-400" : "text-stone-600"
            }`}>
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-px flex-1 transition-colors ${i < idx ? "bg-emerald-500/40" : "bg-stone-800"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ── step 1: branch ─────────────────────────────────────────────────────────── */

function BranchStep({ onSelect }: { onSelect: (b: ApiBranch) => void }) {
  const [branches, setBranches] = React.useState<ApiBranch[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`${API.public.branches}?limit=50`)
      .then((r) => r.json())
      .then((j) => setBranches(j.data?.items ?? j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Choose a branch</h2>
      <p className="mb-5 text-sm text-stone-400">Pick the salon location nearest to you</p>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-stone-600" /></div>
      ) : branches.length === 0 ? (
        <p className="py-16 text-center text-stone-500">No branches available yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {branches.map((b) => (
            <button
              key={b.id}
              onClick={() => onSelect(b)}
              className="group flex items-center gap-3 overflow-hidden rounded-2xl border border-white/8 bg-stone-900 text-left transition hover:border-amber-500/40 hover:bg-stone-800"
            >
              <div className="relative size-20 shrink-0 overflow-hidden bg-stone-800">
                {b.coverImage
                  ? <Image src={b.coverImage} alt={b.name} fill className="object-cover opacity-80 transition group-hover:opacity-100" sizes="80px" />
                  : <div className="flex size-full items-center justify-center text-stone-700 text-xl font-bold opacity-30">{b.name[0]}</div>
                }
              </div>
              <div className="min-w-0 flex-1 py-3 pr-4">
                <p className="font-semibold text-stone-100 group-hover:text-amber-400 transition">{b.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
                  <MapPin className="size-3 shrink-0" />{b.city} — {b.address}
                </p>
              </div>
              <ChevronRight className="mr-3 size-4 text-stone-600 group-hover:text-amber-400 transition" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── step 2: service ─────────────────────────────────────────────────────────── */

function ServiceStep({ branchId, onSelect }: { branchId: string; onSelect: (s: PreloadedService) => void }) {
  // Result is tagged with the request it answers, so "loading" is derived from
  // (result is stale) rather than set from inside the effect body.
  const [result, setResult] = React.useState<{ key: string; items: ApiService[] } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`${API.public.services}?branchId=${branchId}&limit=100`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setResult({ key: branchId, items: j.data?.items ?? j.data ?? [] });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: branchId, items: [] });
      });
    return () => { cancelled = true; };
  }, [branchId]);

  const loading = result?.key !== branchId;
  const services = result?.key === branchId ? result.items : [];

  // Group by category
  const groupMap = new Map<string, { name: string; items: ApiService[] }>();
  for (const s of services) {
    if (!groupMap.has(s.category.name)) groupMap.set(s.category.name, { name: s.category.name, items: [] });
    groupMap.get(s.category.name)!.items.push(s);
  }
  const grouped = Array.from(groupMap.values());

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Select a service</h2>
      <p className="mb-5 text-sm text-stone-400">What would you like today?</p>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-stone-600" /></div>
      ) : services.length === 0 ? (
        <p className="py-16 text-center text-stone-500">No services listed at this branch yet.</p>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ name: cat, items }) => (
            <div key={cat}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-500">{cat}</p>
              <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/8 bg-stone-900">
                {items.map((s) => {
                  const price = s.branchPricings?.[0]?.price ?? s.basePrice;
                  return (
                    <button
                      key={s.id}
                      onClick={() => onSelect({ ...s, price })}
                      className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/4"
                    >
                      {s.image ? (
                        <Image src={s.image} alt={s.name} width={44} height={44}
                          className="size-11 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-stone-800">
                          <Scissors className="size-4 text-stone-600" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-stone-100 group-hover:text-amber-400 transition">{s.name}</p>
                        <p className="text-xs text-stone-500">{s.duration} min</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-amber-400">₹{price.toLocaleString("en-IN")}</p>
                        <ChevronRight className="ml-auto mt-0.5 size-3.5 text-stone-700 group-hover:text-amber-400 transition" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── step 3: stylist ────────────────────────────────────────────────────────── */

// Expanded stylist detail: rating breakdown, services offered, recent reviews.
// Fetched lazily — only when the customer actually opens a card.
function WorkerDetailPanel({ workerId }: { workerId: string }) {
  const [result, setResult] = React.useState<{
    key: string;
    detail: WorkerDetail | null;
    reviews: WorkerReview[];
    error: string | null;
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(API.public.worker(workerId)).then((r) => r.json()),
      fetch(`${API.public.workerReviews(workerId)}?limit=3`).then((r) => r.json()),
    ])
      .then(([d, rv]) => {
        if (cancelled) return;
        if (!d.success) throw new Error(d.message ?? "Could not load stylist");
        setResult({ key: workerId, detail: d.data, reviews: rv.data?.items ?? [], error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setResult({
          key: workerId,
          detail: null,
          reviews: [],
          error: e instanceof Error ? e.message : "Could not load stylist",
        });
      });

    return () => { cancelled = true; };
  }, [workerId]);

  const fresh = result?.key === workerId ? result : null;
  const loading = fresh === null;
  const error = fresh?.error ?? null;
  const detail = fresh?.detail ?? null;
  const reviews = fresh?.reviews ?? [];

  if (loading) {
    return (
      <div className="flex justify-center border-t border-white/8 py-6">
        <Loader2 className="size-4 animate-spin text-stone-600" />
      </div>
    );
  }
  if (error || !detail) {
    return (
      <p className="border-t border-white/8 px-4 py-4 text-center text-xs text-stone-500">
        {error ?? "Could not load worker details"}
      </p>
    );
  }

  const total = detail.reviewCount;

  return (
    <div className="space-y-4 border-t border-white/8 bg-stone-950/40 px-4 py-4">
      {detail.bio && <p className="text-xs leading-relaxed text-stone-400">{detail.bio}</p>}

      <div className="flex flex-wrap gap-4 text-xs text-stone-400">
        <span className="flex items-center gap-1.5">
          <Award className="size-3.5 text-stone-300" />
          {detail.experience} yr{detail.experience === 1 ? "" : "s"} experience
        </span>
        <span className="flex items-center gap-1.5">
          <Check className="size-3.5 text-emerald-400" />
          {detail.completedServices} completed
        </span>
      </div>

      {/* Rating distribution — monochrome bars, no amber. */}
      {total > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Ratings</p>
          {([5, 4, 3, 2, 1] as const).map((n) => {
            const count = detail.ratingDistribution[String(n) as "1" | "2" | "3" | "4" | "5"] ?? 0;
            const pct = total ? (count / total) * 100 : 0;
            return (
              <div key={n} className="flex items-center gap-2">
                <span className="w-6 text-[10px] text-stone-500">{n}★</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-800">
                  <div className="h-full rounded-full bg-stone-300" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-6 text-right text-[10px] text-stone-500">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Services offered */}
      {detail.services.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-500">Services offered</p>
          <div className="flex flex-wrap gap-1.5">
            {detail.services.map((s) => (
              <span key={s.id} className="rounded-lg bg-stone-800 px-2 py-1 text-[11px] text-stone-300">
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent reviews */}
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-500">Recent reviews</p>
        {reviews.length === 0 ? (
          <p className="text-xs text-stone-600">No reviews yet — be the first.</p>
        ) : (
          <div className="space-y-2">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-white/8 bg-stone-900 px-3 py-2">
                <div className="flex items-center gap-2">
                  <Stars value={r.overallRating} className="size-3" />
                  <span className="text-[11px] text-stone-500">{r.customer?.firstName ?? "Guest"}</span>
                </div>
                {r.comment && <p className="mt-1 text-xs text-stone-400">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* The full read-only portfolio opens in a new tab, so a booking in progress
          is never lost. */}
      <a
        href={`/stylists/${workerId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-300 underline-offset-4 transition hover:text-white hover:underline"
      >
        View full portfolio
        <ChevronRight className="size-3.5" />
      </a>
    </div>
  );
}

function WorkerStep({
  branchId, serviceId, serviceName, onSelect,
}: {
  branchId: string;
  serviceId: string;
  serviceName: string;
  onSelect: (worker: ApiWorker | null) => void;
}) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    key: string;
    items: ApiWorker[];
    error: string | null;
  } | null>(null);

  const key = `${branchId}|${serviceId}`;

  React.useEffect(() => {
    let cancelled = false;

    // Only stylists at this branch who are qualified for this service.
    fetch(`${API.public.workers}?branchId=${branchId}&serviceId=${serviceId}&date=${today()}&limit=50`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.success) throw new Error(j.message ?? "Could not load stylists");
        setResult({ key: `${branchId}|${serviceId}`, items: j.data?.items ?? [], error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setResult({
          key: `${branchId}|${serviceId}`,
          items: [],
          error: e instanceof Error ? e.message : "Could not load stylists",
        });
      });

    return () => { cancelled = true; };
  }, [branchId, serviceId]);

  const fresh = result?.key === key ? result : null;
  const loading = fresh === null;
  const error = fresh?.error ?? null;
  const workers = fresh?.items ?? [];

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Choose your worker</h2>
      <p className="mb-5 text-sm text-stone-400">Only workers who perform this service at this branch are shown</p>

      <BookingSuggestTips serviceName={serviceName} branchId={branchId} />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-stone-600" /></div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
      ) : (
        <div className="space-y-3">
          {/* Any-stylist option keeps the original "book without picking" path. */}
          <button
            onClick={() => onSelect(null)}
            className="group flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-stone-900 p-4 text-left transition hover:border-white/25 hover:bg-stone-800"
          >
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-stone-800">
              <Users className="size-5 text-stone-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-stone-100">Any available worker</p>
              <p className="text-xs text-stone-500">We&apos;ll assign the best available professional</p>
            </div>
            <ChevronRight className="size-4 text-stone-600 transition group-hover:text-stone-300" />
          </button>

          {workers.length === 0 ? (
            <p className="rounded-2xl border border-white/8 bg-stone-900 py-10 text-center text-sm text-stone-500">
              No worker at this branch offers this service yet — pick “Any available worker”,
              or choose a different service.
            </p>
          ) : (
            workers.map((w) => {
              const isOpen = expanded === w.id;
              // Highest-proficiency skills first, from the list payload — no fetch.
              const topSkills = [...w.skills]
                .sort((a, b) => b.proficiency - a.proficiency)
                .slice(0, 3)
                .map((s) => s.skill.name);
              return (
                <div
                  key={w.id}
                  className="overflow-hidden rounded-2xl border border-white/8 bg-stone-900 transition hover:border-white/20"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-stone-800 ring-1 ring-white/10">
                        {w.profilePhoto ? (
                          <Image src={w.profilePhoto} alt={workerName(w)} fill className="object-cover" sizes="64px" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-lg font-bold text-stone-600">
                            {w.firstName[0]}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-stone-100">{workerName(w)}</p>
                          {w.reviewCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-stone-800 px-2 py-0.5 text-[11px] font-medium text-stone-200">
                              <Star className="size-3 fill-stone-100 text-stone-100" />
                              {w.averageRating.toFixed(1)}
                              <span className="text-stone-500">({w.reviewCount})</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-stone-600">No reviews yet</span>
                          )}
                        </div>

                        <p className="mt-0.5 text-xs text-stone-500">
                          {w.designation?.name && <>{w.designation.name} · </>}
                          {w.experience} yr{w.experience === 1 ? "" : "s"} experience
                        </p>

                        {topSkills.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {topSkills.map((name) => (
                              <span
                                key={name}
                                className="rounded-md bg-stone-800 px-1.5 py-0.5 text-[10px] font-medium text-stone-300"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        )}

                        {w.languages.length > 0 && (
                          <p className="mt-1.5 text-[11px] text-stone-500">Speaks {w.languages.join(", ")}</p>
                        )}

                        {w.availableToday === true ? (
                          <p className="mt-1.5 text-xs font-medium text-emerald-400">
                            Available today{w.nextSlot ? ` · next ${w.nextSlot}` : ""}
                          </p>
                        ) : w.availableToday === false ? (
                          <p className="mt-1.5 text-xs text-stone-600">Fully booked today — other dates available</p>
                        ) : null}
                      </div>
                    </div>

                    {/* Portfolio (inline preview) + Select (primary). */}
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={() => setExpanded(isOpen ? null : w.id)}
                        aria-expanded={isOpen}
                        className="inline-flex flex-1 items-center justify-center rounded-full border border-white/12 px-4 py-2 text-xs font-semibold text-stone-200 transition hover:border-white/25 hover:bg-white/5"
                      >
                        {isOpen ? "Hide portfolio" : "Portfolio"}
                      </button>
                      <button
                        onClick={() => onSelect(w)}
                        className="inline-flex flex-1 items-center justify-center rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-950 transition hover:bg-stone-200 active:scale-[0.98]"
                      >
                        Select
                      </button>
                    </div>
                  </div>

                  {isOpen && <WorkerDetailPanel workerId={w.id} />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* ── step 4: date + slot ────────────────────────────────────────────────────── */

function SlotStep({
  branchId, serviceId, workerId,
  onSelect,
}: {
  branchId: string; serviceId: string; workerId: string | null;
  onSelect: (date: string, slot: string) => void;
}) {
  const dates = React.useMemo(() => Array.from({ length: DATE_COUNT }, (_, i) => addDays(today(), i)), []);
  const [selectedDate, setSelectedDate] = React.useState(dates[0]);
  const [result, setResult] = React.useState<{
    key: string;
    slots: string[];
    msg: string | null;
  } | null>(null);

  const key = `${branchId}|${serviceId}|${workerId ?? ""}|${selectedDate}`;

  React.useEffect(() => {
    let cancelled = false;

    // With a workerId the API returns ONLY that stylist's free slots, so one
    // stylist's bookings never remove slots from another's schedule.
    const q = new URLSearchParams({ branchId, serviceId, date: selectedDate });
    if (workerId) q.set("workerId", workerId);
    const reqKey = `${branchId}|${serviceId}|${workerId ?? ""}|${selectedDate}`;

    fetch(`${API.public.slots}?${q.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const list: string[] = j.data?.slots ?? [];
        const msg = !j.success
          ? j.message ?? "Could not load slots"
          : list.length === 0
            ? "No slots available — try another date"
            : null;
        setResult({ key: reqKey, slots: list, msg });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: reqKey, slots: [], msg: "Failed to load slots" });
      });

    return () => { cancelled = true; };
  }, [branchId, serviceId, workerId, selectedDate]);

  const fresh = result?.key === key ? result : null;
  const loading = fresh === null;
  const slots = fresh?.slots ?? [];
  const msg = fresh?.msg ?? null;

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Pick a date & time</h2>
      <p className="mb-5 text-sm text-stone-400">
        {workerId ? "Showing only your stylist's free slots" : "Choose when you'd like to come in"}
      </p>

      {/* Horizontal date scroller */}
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {dates.map((d) => {
          const dt = new Date(d);
          const isToday = d === today();
          return (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              className={`flex shrink-0 flex-col items-center rounded-2xl border px-3.5 py-2.5 text-center transition ${
                selectedDate === d
                  ? "border-amber-500 bg-amber-500/10 text-amber-400"
                  : "border-white/8 bg-stone-900 text-stone-400 hover:border-white/15 hover:text-stone-200"
              }`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide">
                {isToday ? "Today" : dt.toLocaleDateString("en-IN", { weekday: "short" })}
              </span>
              <span className="mt-0.5 text-xl font-bold leading-tight">{dt.getDate()}</span>
              <span className="text-[10px] text-stone-500">{dt.toLocaleDateString("en-IN", { month: "short" })}</span>
            </button>
          );
        })}
      </div>

      {/* Slots grid */}
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-stone-500">
        <CalendarDays className="mr-1 inline size-3.5" />
        {fmtDate(selectedDate)}
      </p>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-5 animate-spin text-stone-600" /></div>
      ) : msg ? (
        <p className="py-10 text-center text-sm text-stone-500">{msg}</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
          {slots.map((slot) => (
            <button
              key={slot}
              onClick={() => onSelect(selectedDate, slot)}
              className="rounded-xl border border-white/8 bg-stone-900 py-3 text-center text-sm font-medium text-stone-300 transition hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-400"
            >
              {slot}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── step 4: confirm ────────────────────────────────────────────────────────── */

function ConfirmStep({
  branch, service, worker, date, slot, notes,
  onNotes, onConfirm, loading, error,
}: {
  branch: PreloadedBranch; service: PreloadedService;
  worker: ApiWorker | null;
  date: string; slot: string; notes: string;
  onNotes: (v: string) => void;
  onConfirm: () => void;
  loading: boolean; error: string | null;
}) {
  const end = endTime(slot, service.duration);
  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Confirm booking</h2>
      <p className="mb-5 text-sm text-stone-400">Review your appointment details below</p>

      {/* Summary card */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-white/8 bg-stone-900">
        {/* Branch banner */}
        <div className="relative h-24 w-full overflow-hidden bg-stone-800">
          {branch.coverImage && (
            <Image src={branch.coverImage} alt={branch.name} fill className="object-cover opacity-50" sizes="100vw" />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-stone-900 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4">
            <p className="text-xs text-stone-400">Branch</p>
            <p className="font-semibold text-stone-100">{branch.name} · {branch.city}</p>
          </div>
        </div>

        <div className="divide-y divide-white/5 px-4">
          <Row label="Service">
            <span className="font-medium text-stone-200">{service.name}</span>
          </Row>
          <Row label="Stylist">
            {worker ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="font-medium text-stone-200">{workerName(worker)}</span>
                {worker.reviewCount > 0 && (
                  <span className="flex items-center gap-0.5 text-xs text-amber-400">
                    <Star className="size-3 fill-amber-400" />{worker.averageRating.toFixed(1)}
                  </span>
                )}
              </span>
            ) : (
              <span className="font-medium text-stone-400">Any available stylist</span>
            )}
          </Row>
          <Row label="Date">
            <span className="font-medium text-stone-200">{fmtDate(date)}</span>
          </Row>
          <Row label="Time">
            <span className="font-medium text-stone-200">{slot} – {end} <span className="text-stone-500">({service.duration} min)</span></span>
          </Row>
          <Row label="Amount" highlight>
            <span className="text-lg font-bold text-amber-400">₹{service.price.toLocaleString("en-IN")}</span>
          </Row>
        </div>
      </div>

      {/* Notes */}
      <textarea
        value={notes}
        onChange={(e) => onNotes(e.target.value)}
        placeholder="Any special requests? (optional)"
        rows={2}
        className="mb-4 w-full resize-none rounded-2xl border border-white/8 bg-stone-900 px-4 py-3 text-sm text-stone-200 placeholder:text-stone-600 focus:border-amber-500/40 focus:outline-none"
      />

      {error && (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={onConfirm}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 text-base font-bold text-stone-950 transition hover:bg-amber-400 active:scale-[0.98] disabled:opacity-60"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {loading ? "Booking…" : "Confirm Appointment →"}
      </button>
      <p className="mt-3 text-center text-xs text-stone-600">Pay at the salon · Free cancellation</p>
    </div>
  );
}

function Row({ label, children, highlight }: { label: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-3 ${highlight ? "bg-transparent" : ""}`}>
      <span className="text-sm text-stone-500">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

/* ── inline phone-OTP (shown when confirming while signed out) ───────────────── */
function InlineAuth({
  phase, name, onName, phone, onPhone, otp, onOtp, devOtp, loading, error, onSend, onVerify, onBack,
}: {
  phase: "phone" | "code";
  name: string; onName: (v: string) => void;
  phone: string; onPhone: (v: string) => void;
  otp: string; onOtp: (v: string) => void;
  devOtp: string | null;
  loading: boolean; error: string | null;
  onSend: () => void; onVerify: () => void; onBack: () => void;
}) {
  const inputCls =
    "w-full rounded-2xl border border-white/8 bg-stone-900 px-4 py-3 text-sm text-stone-200 placeholder:text-stone-600 focus:border-amber-500/40 focus:outline-none";
  const btnCls =
    "flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3.5 text-sm font-bold text-stone-950 transition hover:bg-amber-400 disabled:opacity-60";
  return (
    <div className="mt-6 rounded-2xl border border-amber-500/20 bg-stone-900/70 p-5">
      <h3 className="text-base font-semibold text-white">Sign in to confirm</h3>
      <p className="mt-1 text-sm text-stone-400">
        {phase === "phone"
          ? "Enter your mobile number — we'll send a one-time code to secure your booking."
          : "Enter the code we just sent."}
      </p>
      {error && (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
      )}
      {phase === "phone" ? (
        <form onSubmit={(e) => { e.preventDefault(); onSend(); }} className="mt-4 space-y-3">
          <input
            type="text" value={name} onChange={(e) => onName(e.target.value)}
            placeholder="Full name" autoFocus className={inputCls}
          />
          <input
            type="tel" inputMode="tel" value={phone} onChange={(e) => onPhone(e.target.value)}
            placeholder="Mobile number" className={inputCls}
          />
          <button type="submit" disabled={loading} className={btnCls}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); onVerify(); }} className="mt-4 space-y-3">
          <p className="text-sm text-stone-300">
            Code sent to <span className="font-medium text-white">{phone}</span>
          </p>
          <input
            inputMode="numeric" maxLength={6} value={otp}
            onChange={(e) => onOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="6-digit code" autoFocus
            className={`${inputCls} text-center font-mono text-lg tracking-[0.4em] placeholder:tracking-normal`}
          />
          {devOtp && (
            <p className="text-center text-xs text-stone-500">
              Dev code: <span className="font-mono font-semibold text-amber-400">{devOtp}</span>
            </p>
          )}
          <button type="submit" disabled={loading} className={btnCls}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Confirming…" : "Verify & confirm booking"}
          </button>
          <button type="button" onClick={onBack} className="w-full text-center text-xs text-stone-500 transition hover:text-stone-300">
            ← Use a different number
          </button>
        </form>
      )}
    </div>
  );
}

/* ── main wizard ────────────────────────────────────────────────────────────── */

export function BookWizard({
  initialBranch,
  initialService,
}: {
  initialBranch: PreloadedBranch | null;
  initialService: PreloadedService | null;
}) {
  const router = useRouter();

  // Determine initial step based on what was pre-loaded server-side
  const initStep: Step =
    initialBranch && initialService ? "worker"
    : initialBranch ? "service"
    : "branch";

  const [step, setStep] = React.useState<Step>(initStep);
  const [branch, setBranch] = React.useState<PreloadedBranch | null>(initialBranch);
  const [service, setService] = React.useState<PreloadedService | null>(initialService);
  // `worker === null` is a valid choice ("any stylist"), so a separate flag
  // tracks whether the customer has actually made the choice yet.
  const [worker, setWorker] = React.useState<ApiWorker | null>(null);
  const [workerChosen, setWorkerChosen] = React.useState(false);
  const [date, setDate] = React.useState("");
  const [slot, setSlot] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [confirmLoading, setConfirmLoading] = React.useState(false);
  const [confirmError, setConfirmError] = React.useState<string | null>(null);

  // Inline phone-OTP: shown when confirming a booking while signed out, so the
  // customer authenticates without leaving the flow, then the booking completes.
  const [needsAuth, setNeedsAuth] = React.useState(false);
  const [authPhase, setAuthPhase] = React.useState<"phone" | "code">("phone");
  const [custName, setCustName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [devOtp, setDevOtp] = React.useState<string | null>(null);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);

  function resetWorker() {
    setWorker(null);
    setWorkerChosen(false);
  }

  async function handleConfirm() {
    if (!branch || !service || !date || !slot) return;
    setConfirmLoading(true); setConfirmError(null);
    try {
      const res = await fetch(API.customer.appointments, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: branch.id,
          // Omitted entirely when the customer picked "any stylist".
          ...(worker ? { workerId: worker.id } : {}),
          services: [{ serviceId: service.id }],
          appointmentDate: date,
          startTime: slot,
          endTime: endTime(slot, service.duration),
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (res.status === 401) {
        // Signed out — authenticate inline via phone OTP, then retry this booking.
        setNeedsAuth(true);
        return;
      }
      if (!res.ok) throw new Error(json?.error ?? json?.message ?? "Booking failed");
      router.push(`/customer/bookings/${json.data?.id ?? ""}`);
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : "Booking failed. Please try again.");
    } finally {
      setConfirmLoading(false);
    }
  }

  // Step 1 of inline auth: send a one-time code to the entered phone.
  async function sendOtp() {
    if (!custName.trim()) { setAuthError("Enter your name"); return; }
    const p = phone.trim();
    if (!p) { setAuthError("Enter your mobile number"); return; }
    setAuthLoading(true); setAuthError(null);
    try {
      const res = await fetch(API.auth.otpSend, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false) throw new Error(json?.message ?? "Could not send code");
      setDevOtp(json?.data?.devOtp ?? null);
      setAuthPhase("code");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Could not send code");
    } finally { setAuthLoading(false); }
  }

  // Step 2: verify the code (auto-registers a customer if new), then complete the
  // booking. The verify response sets the session cookie, so handleConfirm's retry
  // is authenticated.
  async function verifyAndBook() {
    const code = otp.trim();
    if (!code) { setAuthError("Enter the 6-digit code"); return; }
    setAuthLoading(true); setAuthError(null);
    try {
      const res = await fetch(API.auth.otpVerify, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), otp: code, firstName: custName.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false || !json?.data) throw new Error(json?.message ?? "Invalid code");
      setNeedsAuth(false);
      await handleConfirm();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Invalid code");
    } finally { setAuthLoading(false); }
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <StepBar current={step} />

        <BookingBar
          branch={branch} service={service} worker={worker} workerChosen={workerChosen}
          date={date} slot={slot}
          onChangeBranch={() => { setBranch(null); setService(null); resetWorker(); setDate(""); setSlot(""); setStep("branch"); }}
          onChangeService={() => { setService(null); resetWorker(); setDate(""); setSlot(""); setStep("service"); }}
          onChangeWorker={() => { resetWorker(); setDate(""); setSlot(""); setStep("worker"); }}
          onChangeSlot={() => { setDate(""); setSlot(""); setStep("slot"); }}
        />

        {step === "branch" && (
          <BranchStep
            onSelect={(b) => {
              setBranch(b); setService(null); resetWorker(); setDate(""); setSlot("");
              setStep("service");
            }}
          />
        )}

        {step === "service" && branch && (
          <>
            <button
              onClick={() => { setBranch(null); setStep("branch"); }}
              className="mb-4 flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-300 transition"
            >
              <ChevronLeft className="size-4" /> Change branch
            </button>
            <ServiceStep
              branchId={branch.id}
              onSelect={(s) => { setService(s); resetWorker(); setDate(""); setSlot(""); setStep("worker"); }}
            />
          </>
        )}

        {step === "worker" && branch && service && (
          <>
            <button
              onClick={() => { setService(null); resetWorker(); setStep("service"); }}
              className="mb-4 flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-300 transition"
            >
              <ChevronLeft className="size-4" /> Change service
            </button>
            <WorkerStep
              branchId={branch.id}
              serviceId={service.id}
              serviceName={service.name}
              onSelect={(w) => {
                setWorker(w); setWorkerChosen(true);
                setDate(""); setSlot(""); setStep("slot");
              }}
            />
          </>
        )}

        {step === "slot" && branch && service && (
          <>
            <button
              onClick={() => { resetWorker(); setDate(""); setSlot(""); setStep("worker"); }}
              className="mb-4 flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-300 transition"
            >
              <ChevronLeft className="size-4" /> Change worker
            </button>
            <SlotStep
              branchId={branch.id}
              serviceId={service.id}
              workerId={worker?.id ?? null}
              onSelect={(d, s) => { setDate(d); setSlot(s); setStep("confirm"); }}
            />
          </>
        )}

        {step === "confirm" && branch && service && date && slot && (
          <>
            <button
              onClick={() => { setDate(""); setSlot(""); setStep("slot"); }}
              className="mb-4 flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-300 transition"
            >
              <ChevronLeft className="size-4" /> Change time
            </button>
            <ConfirmStep
              branch={branch} service={service} worker={worker} date={date} slot={slot}
              notes={notes} onNotes={setNotes}
              onConfirm={handleConfirm}
              loading={confirmLoading} error={confirmError}
            />
            {needsAuth && (
              <InlineAuth
                phase={authPhase}
                name={custName} onName={setCustName}
                phone={phone} onPhone={setPhone}
                otp={otp} onOtp={setOtp} devOtp={devOtp}
                loading={authLoading} error={authError}
                onSend={sendOtp} onVerify={verifyAndBook}
                onBack={() => { setAuthPhase("phone"); setOtp(""); setAuthError(null); }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
