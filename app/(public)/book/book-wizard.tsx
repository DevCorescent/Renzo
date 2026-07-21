"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { API } from "@/lib/endpoints";
import {
  MapPin,
  Scissors,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  CalendarDays,
  X,
  Star,
  User,
  Award,
  Users,
  Sparkles,
  ShieldCheck,
  Wallet,
  BadgeCheck,
} from "lucide-react";
import { BookingSuggestTips } from "@/components/ai/booking-suggest-tips";
import {
  GoogleLoginButton,
  GOOGLE_ENABLED,
} from "@/components/shared/google-login-button";

/* ── shared types (exported for use in server page) ────────────────────────── */

export type PreloadedBranch = {
  id: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  coverImage: string | null;
};
export type PreloadedService = {
  id: string;
  name: string;
  image: string | null;
  duration: number;
  gender: string;
  basePrice: number;
  category: { name: string };
  price: number;
};

type ApiBranch = PreloadedBranch;
type ApiService = {
  id: string;
  name: string;
  image: string | null;
  duration: number;
  gender: string;
  basePrice: number;
  category: { name: string };
  branchPricings?: { price: number }[];
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

function workerName(w: {
  firstName: string;
  lastName: string;
  displayName: string | null;
}) {
  return w.displayName?.trim() || `${w.firstName} ${w.lastName}`.trim();
}

/* ── helpers ────────────────────────────────────────────────────────────────── */

function today() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(base: string, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function endTime(start: string, mins: number) {
  const [h, m] = start.split(":").map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const SERVICE_CATEGORY_PLACEHOLDER: Record<string, string> = {
  hair: "https://images.unsplash.com/photo-1542831371-d531d36971e6?auto=format&fit=crop&w=900&q=80",
  nails:
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
  skin: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=80",
  "hair care":
    "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=900&q=80",
};

function getServiceCardImage(category: string) {
  return (
    SERVICE_CATEGORY_PLACEHOLDER[category.toLowerCase()] ??
    SERVICE_CATEGORY_PLACEHOLDER.hair
  );
}

function getServiceDescription(service: ApiService) {
  switch (service.category.name.toLowerCase()) {
    case "hair":
      return `${service.name} with wash, precision styling, and a polished finish.`;
    case "nails":
      return `Classic manicure with gentle care and long-lasting shine.`;
    case "skin":
      return `Revitalizing facial treatment for brighter, smoother skin.`;
    case "hair care":
      return `Relaxing treatment designed for scalp health and hair strength.`;
    default:
      return `${service.name} delivered with premium care and attention to detail.`;
  }
}

const DATE_COUNT = 14;

/* ── top booking bar: shows selections made so far ──────────────────────────── */

function BookingBar({
  branch,
  services,
  worker,
  workerChosen,
  date,
  slot,
  onChangeBranch,
  onChangeService,
  onChangeWorker,
  onChangeSlot,
}: {
  branch: PreloadedBranch | null;
  services: PreloadedService[];
  worker: ApiWorker | null;
  workerChosen: boolean;
  date: string;
  slot: string;
  onChangeBranch: () => void;
  onChangeService: () => void;
  onChangeWorker: () => void;
  onChangeSlot: () => void;
}) {
  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
  if (!branch && services.length === 0) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-white/8 bg-stone-900/80 p-3">
      {branch && (
        <button
          onClick={onChangeBranch}
          className="group flex items-center gap-2 rounded-xl bg-stone-800 px-3 py-2 text-left transition hover:bg-stone-700"
        >
          <MapPin className="size-3.5 shrink-0 text-stone-400" />
          <span className="text-xs font-medium text-stone-200">
            {branch.name}
          </span>
          <X className="size-3 text-stone-600 group-hover:text-red-400 transition" />
        </button>
      )}
      {services.length > 0 && (
        <button
          onClick={onChangeService}
          className="group flex items-center gap-2 rounded-xl bg-stone-800 px-3 py-2 text-left transition hover:bg-stone-700"
        >
          <Scissors className="size-3.5 shrink-0 text-stone-400" />
          <span className="text-xs font-medium text-stone-200">
            {services.length === 1 ? services[0].name : `${services.length} services`}
          </span>
          <span className="text-xs font-semibold text-stone-100">
            ₹{totalPrice.toLocaleString("en-IN")}
          </span>
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
          <span className="text-xs font-medium text-stone-200">
            {fmtDate(date).split(",")[0]}, {slot}
          </span>
          <X className="size-3 text-stone-600 group-hover:text-red-400 transition" />
        </button>
      )}
    </div>
  );
}

/* ── stars ──────────────────────────────────────────────────────────────────── */

function Stars({
  value,
  className = "size-3.5",
}: {
  value: number;
  className?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${value} out of 5`}
    >
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
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition duration-200 ease-out ${
                i < idx
                  ? "bg-stone-100 text-stone-950 border-stone-200 shadow-sm"
                  : i === idx
                    ? "bg-white text-stone-950 ring-2 ring-stone-300 border-white/20 shadow-[0_0_0_4px_rgba(220,222,221,0.12)]"
                    : "bg-transparent text-stone-500 border border-stone-700/70 opacity-60"
              }`}
            >
              {i < idx ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={`hidden text-xs font-medium sm:inline transition duration-200 ${
                i === idx
                  ? "text-stone-100"
                  : i < idx
                    ? "text-stone-200"
                    : "text-stone-500 opacity-50"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`h-px flex-1 transition-colors duration-200 ${i < idx ? "bg-stone-600/40" : "bg-stone-800"}`}
            />
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
      <p className="mb-5 text-sm text-stone-400">
        Pick the salon location nearest to you
      </p>
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-stone-600" />
        </div>
      ) : branches.length === 0 ? (
        <p className="py-16 text-center text-stone-500">
          No branches available yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((b, index) => {
            const distance = `${(2.4 + index * 0.3).toFixed(1)} km away`;
            const isOpen = index % 2 === 0;
            return (
              <button
                key={b.id}
                onClick={() => onSelect(b)}
                className="group flex flex-col gap-4 overflow-hidden rounded-3xl border border-white/10 bg-stone-900/95 p-5 text-left shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-36px_rgba(255,255,255,0.22)] hover:border-stone-300/50 hover:bg-stone-800"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-3xl bg-stone-800 ring-1 ring-white/10">
                    {b.coverImage ? (
                      <Image
                        src={b.coverImage}
                        alt={b.name}
                        fill
                        className="object-cover opacity-90 transition group-hover:opacity-100"
                        sizes="80px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-stone-600 text-xl font-bold opacity-40">
                        {b.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-stone-100 transition group-hover:text-stone-50">
                      {b.name}
                    </p>
                    <p className="mt-1 text-sm text-stone-400">
                      {b.city} · {b.address}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2 text-[11px] text-stone-300">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-stone-800/80 px-3 py-1 font-medium">
                      {distance}
                    </span>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 font-medium ${isOpen ? "bg-emerald-500/10 text-emerald-200" : "bg-stone-800 text-stone-400"}`}
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${isOpen ? "bg-emerald-400" : "bg-stone-500"}`}
                      />
                      {isOpen ? "Open now" : "Closed"}
                    </span>
                  </div>
                  <ChevronRight className="size-4 text-stone-500 transition group-hover:text-stone-200" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── step 2: service ─────────────────────────────────────────────────────────── */

function ServiceStep({
  branchId,
  selected,
  onToggle,
  onContinue,
}: {
  branchId: string;
  selected: PreloadedService[];
  onToggle: (s: PreloadedService) => void;
  onContinue: () => void;
}) {
  const selectedIds = new Set(selected.map((s) => s.id));
  // Result is tagged with the request it answers, so "loading" is derived from
  // (result is stale) rather than set from inside the effect body.
  const [result, setResult] = React.useState<{
    key: string;
    items: ApiService[];
  } | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`${API.public.services}?branchId=${branchId}&limit=100`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled)
          setResult({ key: branchId, items: j.data?.items ?? j.data ?? [] });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: branchId, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  const loading = result?.key !== branchId;
  const services = result?.key === branchId ? result.items : [];

  // Group by category
  const groupMap = new Map<string, { name: string; items: ApiService[] }>();
  for (const s of services) {
    if (!groupMap.has(s.category.name))
      groupMap.set(s.category.name, { name: s.category.name, items: [] });
    groupMap.get(s.category.name)!.items.push(s);
  }
  const grouped = Array.from(groupMap.values());

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Select services</h2>
      <p className="mb-5 text-sm text-stone-400">Pick one or more services for your visit</p>
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-stone-600" />
        </div>
      ) : services.length === 0 ? (
        <p className="py-16 text-center text-stone-500">
          No services listed at this branch yet.
        </p>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ name: cat, items }) => (
            <div key={cat}>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                {cat}
              </p>
              <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                {items.map((s) => {
                  const price = s.branchPricings?.[0]?.price ?? s.basePrice;
                  const isSelected = selectedIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => onToggle({ ...s, price })}
                      className={`group relative overflow-hidden rounded-3xl border shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_20px_60px_-36px_rgba(255,255,255,0.2)] ${
                        isSelected
                          ? "border-stone-200/60 bg-stone-800 ring-1 ring-stone-300/30"
                          : "border-white/10 bg-stone-900 hover:border-stone-300/50"
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute right-3 top-3 z-10 inline-flex size-6 items-center justify-center rounded-full bg-white text-stone-950 shadow">
                          <Check className="size-3.5" />
                        </span>
                      )}
                      <div className="relative aspect-4/3 overflow-hidden bg-stone-800">
                        <div
                          className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
                          style={{
                            backgroundImage: `url(${getServiceCardImage(
                              s.category.name,
                            )})`,
                          }}
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-stone-950/85 via-stone-950/20 to-transparent" />
                      </div>
                      <div className="space-y-3 px-5 py-5 text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-lg font-semibold text-stone-100">
                              {s.name}
                            </p>
                            <p className="mt-2 text-sm text-stone-400">
                              {getServiceDescription(s)}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-stone-100">
                            ₹{price.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-stone-500">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                            {s.duration} min
                          </span>
                          <span className="text-stone-400">{cat}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <div className="sticky bottom-0 mt-6 rounded-2xl border border-white/10 bg-stone-950/95 p-4 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-stone-100">
                {selected.length} service{selected.length !== 1 ? "s" : ""} selected
              </p>
              <p className="text-xs text-stone-400">
                ₹{selected.reduce((sum, s) => sum + s.price, 0).toLocaleString("en-IN")} ·{" "}
                {selected.reduce((sum, s) => sum + s.duration, 0)} min total
              </p>
            </div>
            <button
              onClick={onContinue}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-stone-950 transition hover:bg-stone-200 active:scale-[0.98]"
            >
              Continue
              <ChevronRight className="size-4" />
            </button>
          </div>
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
      fetch(`${API.public.workerReviews(workerId)}?limit=3`).then((r) =>
        r.json(),
      ),
    ])
      .then(([d, rv]) => {
        if (cancelled) return;
        if (!d.success) throw new Error(d.message ?? "Could not load stylist");
        setResult({
          key: workerId,
          detail: d.data,
          reviews: rv.data?.items ?? [],
          error: null,
        });
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

    return () => {
      cancelled = true;
    };
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
      {detail.bio && (
        <p className="text-xs leading-relaxed text-stone-400">{detail.bio}</p>
      )}

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
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-500">
            Ratings
          </p>
          {([5, 4, 3, 2, 1] as const).map((n) => {
            const count =
              detail.ratingDistribution[
                String(n) as "1" | "2" | "3" | "4" | "5"
              ] ?? 0;
            const pct = total ? (count / total) * 100 : 0;
            return (
              <div key={n} className="flex items-center gap-2">
                <span className="w-6 text-[10px] text-stone-500">{n}★</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-800">
                  <div
                    className="h-full rounded-full bg-stone-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-6 text-right text-[10px] text-stone-500">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Services offered */}
      {detail.services.length > 0 && (
        <div>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-500">
            Services offered
          </p>
          <div className="flex flex-wrap gap-1.5">
            {detail.services.map((s) => (
              <span
                key={s.id}
                className="rounded-lg bg-stone-800 px-2 py-1 text-[11px] text-stone-300"
              >
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent reviews */}
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-500">
          Recent reviews
        </p>
        {reviews.length === 0 ? (
          <p className="text-xs text-stone-600">
            No reviews yet — be the first.
          </p>
        ) : (
          <div className="space-y-2">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-white/8 bg-stone-900 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Stars value={r.overallRating} className="size-3" />
                  <span className="text-[11px] text-stone-500">
                    {r.customer?.firstName ?? "Guest"}
                  </span>
                </div>
                {r.comment && (
                  <p className="mt-1 text-xs text-stone-400">{r.comment}</p>
                )}
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
  branchId,
  serviceId,
  serviceName,
  onSelect,
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
    fetch(
      `${API.public.workers}?branchId=${branchId}&serviceId=${serviceId}&date=${today()}&limit=50`,
    )
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.success) throw new Error(j.message ?? "Could not load stylists");
        setResult({
          key: `${branchId}|${serviceId}`,
          items: j.data?.items ?? [],
          error: null,
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setResult({
          key: `${branchId}|${serviceId}`,
          items: [],
          error: e instanceof Error ? e.message : "Could not load stylists",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [branchId, serviceId]);

  const fresh = result?.key === key ? result : null;
  const loading = fresh === null;
  const error = fresh?.error ?? null;
  const workers = fresh?.items ?? [];

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Choose your stylist</h2>
      <p className="mb-5 text-sm text-stone-400">
        Only workers who perform this service at this branch are shown
      </p>

      <BookingSuggestTips serviceName={serviceName} branchId={branchId} />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-stone-600" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {/* Any-stylist option keeps the original "book without picking" path. */}
          <button
            onClick={() => onSelect(null)}
            className="group flex h-full flex-col justify-between rounded-3xl border border-white/10 bg-stone-950/80 p-6 text-left shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_20px_60px_-36px_rgba(255,255,255,0.18)] hover:bg-stone-900"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-800 text-2xl text-stone-400">
                <Users />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-stone-100">
                  Any available worker
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  We&apos;ll assign the best available professional
                </p>
              </div>
            </div>
            <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-stone-900 px-3 py-2 text-xs font-semibold text-stone-200">
              <Clock className="size-4 text-stone-400" />
              Available today · next 10:00
            </div>
          </button>

          {workers.length === 0 ? (
            <p className="rounded-2xl border border-white/8 bg-stone-900 py-10 text-center text-sm text-stone-500">
              No worker at this branch offers this service yet — pick “Any
              available worker”, or choose a different service.
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
                  className="overflow-hidden rounded-3xl border border-white/10 bg-stone-900 shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_20px_60px_-36px_rgba(255,255,255,0.16)] hover:border-stone-300/50"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-stone-800 ring-1 ring-white/10">
                        {w.profilePhoto ? (
                          <Image
                            src={w.profilePhoto}
                            alt={workerName(w)}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-stone-500">
                            <User className="size-6" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-stone-100">
                            {workerName(w)}
                          </p>
                          {w.reviewCount > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-stone-800 px-2 py-0.5 text-[11px] font-medium text-stone-200">
                              <Star className="size-3 fill-stone-100 text-stone-100" />
                              {w.averageRating.toFixed(1)}
                              <span className="text-stone-500">
                                ({w.reviewCount})
                              </span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-stone-600">
                              No reviews yet
                            </span>
                          )}
                        </div>

                        <p className="mt-0.5 text-xs text-stone-500">
                          {w.designation?.name && <>{w.designation.name} · </>}
                          {w.experience} yr{w.experience === 1 ? "" : "s"}{" "}
                          experience
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
                          <p className="mt-1.5 text-[11px] text-stone-500">
                            Speaks {w.languages.join(", ")}
                          </p>
                        )}

                        {w.availableToday === true ? (
                          <p className="mt-1.5 text-xs font-medium text-emerald-400">
                            Available today
                            {w.nextSlot ? ` · next ${w.nextSlot}` : ""}
                          </p>
                        ) : w.availableToday === false ? (
                          <p className="mt-1.5 text-xs text-stone-600">
                            Fully booked today — other dates available
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => setExpanded(isOpen ? null : w.id)}
                        aria-expanded={isOpen}
                        className="inline-flex items-center justify-center rounded-full border border-white/12 bg-stone-950 px-4 py-2 text-xs font-semibold text-stone-200 transition hover:border-white/25 hover:bg-white/5"
                      >
                        {isOpen ? "Hide portfolio" : "Portfolio"}
                      </button>
                      <button
                        onClick={() => onSelect(w)}
                        className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-950 transition hover:bg-stone-200 active:scale-[0.98]"
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
  branch,
  services,
  worker,
  onSelect,
}: {
  branch: PreloadedBranch;
  services: PreloadedService[];
  worker: ApiWorker | null;
  onSelect: (date: string, slot: string) => void;
}) {
  const primaryService = services[0];
  const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
  const dates = React.useMemo(
    () => Array.from({ length: DATE_COUNT }, (_, i) => addDays(today(), i)),
    [],
  );
  const [selectedDate, setSelectedDate] = React.useState(dates[0]);
  const [result, setResult] = React.useState<{
    key: string;
    slots: string[];
    slotGrid: Array<{ time: string; status: "AVAILABLE" | "BOOKED" | "PAST" }>;
    msg: string | null;
  } | null>(null);

  const key = `${branch.id}|${primaryService.id}|${worker?.id ?? ""}|${selectedDate}`;

  React.useEffect(() => {
    let cancelled = false;

    // With a workerId the API returns ONLY that stylist's free slots, so one
    // stylist's bookings never remove slots from another's schedule.
    const q = new URLSearchParams({
      branchId: branch.id,
      serviceId: primaryService.id,
      date: selectedDate,
    });
    if (worker) q.set("workerId", worker.id);
    const reqKey = `${branch.id}|${primaryService.id}|${worker?.id ?? ""}|${selectedDate}`;

    fetch(`${API.public.slots}?${q.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const list: string[] = j.data?.slots ?? [];
        const grid: Array<{ time: string; status: "AVAILABLE" | "BOOKED" | "PAST" }> =
          j.data?.slotGrid ?? list.map((time: string) => ({ time, status: "AVAILABLE" as const }));
        const msg = !j.success
          ? (j.message ?? "Could not load slots")
          : grid.length === 0
            ? "No slots available — try another date"
            : null;
        setResult({ key: reqKey, slots: list, slotGrid: grid, msg });
      })
      .catch(() => {
        if (!cancelled)
          setResult({ key: reqKey, slots: [], slotGrid: [], msg: "Failed to load slots" });
      });

    return () => {
      cancelled = true;
    };
  }, [branch, primaryService, worker, selectedDate]);

  const fresh = result?.key === key ? result : null;
  const loading = fresh === null;
  const slotGrid = fresh?.slotGrid ?? [];
  const msg = fresh?.msg ?? null;

  // Hide past slots; keep BOOKED visible so customers see the chair is taken.
  const visible = slotGrid.filter((s) => s.status !== "PAST");
  const sections = [
    {
      label: "Morning",
      items: visible.filter((s) => Number(s.time.slice(0, 2)) < 12),
    },
    {
      label: "Afternoon",
      items: visible.filter((s) => {
        const hour = Number(s.time.slice(0, 2));
        return hour >= 12 && hour < 17;
      }),
    },
    {
      label: "Evening",
      items: visible.filter((s) => Number(s.time.slice(0, 2)) >= 17),
    },
  ].filter((s) => s.items.length > 0);

  const availableCount = visible.filter((s) => s.status === "AVAILABLE").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div>
        <h2 className="mb-1 text-lg font-semibold">Pick a date & time</h2>
        <p className="mb-5 text-sm text-stone-400">
          {worker
            ? "Showing only your stylist's free slots"
            : "Choose when you'd like to come in"}
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
                className={`flex shrink-0 flex-col items-center rounded-xl border px-3.5 py-2.5 text-center transform transition duration-200 ease-out ${
                  selectedDate === d
                    ? "border-stone-200 bg-white/10 text-stone-100 shadow-[0_10px_30px_-24px_rgba(255,255,255,0.25)]"
                    : "border-white/10 bg-stone-900 text-stone-400 hover:border-stone-300/50 hover:text-stone-100 hover:-translate-y-0.5"
                }`}
              >
                <span className="text-[10px] font-medium uppercase tracking-wide">
                  {isToday
                    ? "Today"
                    : dt.toLocaleDateString("en-IN", { weekday: "short" })}
                </span>
                <span className="mt-0.5 text-xl font-bold leading-tight">
                  {dt.getDate()}
                </span>
                <span className="text-[10px] text-stone-500">
                  {dt.toLocaleDateString("en-IN", { month: "short" })}
                </span>
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
          <div className="flex justify-center py-12">
            <Loader2 className="size-5 animate-spin text-stone-600" />
          </div>
        ) : msg && visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-500">{msg}</p>
        ) : sections.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-500">
            No slots available — try another date
          </p>
        ) : (
          <div className="space-y-6">
            {availableCount === 0 && (
              <p className="rounded-xl border border-white/10 bg-stone-950/40 px-3 py-2 text-xs text-stone-400">
                All remaining times are booked. Pick another date or stylist.
              </p>
            )}
            {sections.map(({ label, items }) => (
              <div key={label} className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">
                    {label}
                  </p>
                  <p className="text-xs text-stone-500">
                    {items.filter((i) => i.status === "AVAILABLE").length} open
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {items.map((entry) => {
                    const booked = entry.status === "BOOKED";
                    return (
                      <button
                        key={entry.time}
                        type="button"
                        disabled={booked}
                        onClick={() => {
                          if (!booked) onSelect(selectedDate, entry.time);
                        }}
                        className={`rounded-2xl border px-4 py-4 text-sm font-medium transition duration-200 ease-out ${
                          booked
                            ? "cursor-not-allowed border-white/5 bg-stone-950/60 text-stone-600"
                            : "border-white/10 bg-stone-900 text-stone-300 hover:-translate-y-0.5 hover:border-stone-300/50 hover:bg-stone-800 hover:text-stone-100 hover:shadow-[0_18px_50px_-36px_rgba(255,255,255,0.18)]"
                        }`}
                      >
                        <span className="block">{entry.time}</span>
                        {booked && (
                          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                            Booked
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <aside className="rounded-3xl border border-white/10 bg-stone-900 p-5 text-sm text-stone-300 lg:sticky lg:top-24">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-stone-500">
          Booking summary
        </p>
        <div className="space-y-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-stone-500">
              Branch
            </p>
            <p className="mt-2 font-semibold text-stone-100">{branch.name}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-stone-500">
              {services.length === 1 ? "Service" : "Services"}
            </p>
            {services.map((s) => (
              <p key={s.id} className="mt-1 font-semibold text-stone-100">{s.name}</p>
            ))}
            <p className="text-xs text-stone-500">{totalDuration} min total</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-widest text-stone-500">
              Stylist
            </p>
            <p className="mt-2 font-semibold text-stone-100">
              {worker ? workerName(worker) : "Any available stylist"}
            </p>
          </div>
          <div className="rounded-3xl bg-stone-950/50 p-4">
            <p className="text-[11px] uppercase tracking-widest text-stone-500">
              Running total
            </p>
            <p className="mt-2 text-2xl font-bold text-stone-100">
              ₹{totalPrice.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ── step 4: confirm ────────────────────────────────────────────────────────── */

function ConfirmStep({
  branch,
  services,
  worker,
  date,
  slot,
  notes,
  onNotes,
  onConfirm,
  loading,
  error,
}: {
  branch: PreloadedBranch;
  services: PreloadedService[];
  worker: ApiWorker | null;
  date: string;
  slot: string;
  notes: string;
  onNotes: (v: string) => void;
  onConfirm: () => void;
  loading: boolean;
  error: string | null;
}) {
  const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
  const end = endTime(slot, totalDuration);
  const priceStr = `₹${totalPrice.toLocaleString("en-IN")}`;
  const initials = worker
    ? workerName(worker)
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : null;

  return (
    <div>
      {/* Heading */}
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25">
          <Sparkles className="size-4" />
        </span>
        <div>
          <h2 className="text-lg font-semibold leading-tight">
            Confirm booking
          </h2>
          <p className="text-sm text-stone-400">
            You&apos;re one tap away from a fresh new look
          </p>
        </div>
      </div>

      {/* Ticket-style summary card */}
      <div className="mb-5 overflow-hidden rounded-3xl border border-white/10 bg-stone-900 shadow-[0_40px_90px_-70px_rgba(255,255,255,0.5)]">
        {/* Branch banner */}
        <div className="relative h-32 w-full overflow-hidden bg-stone-800">
          {branch.coverImage && (
            <Image
              src={branch.coverImage}
              alt={branch.name}
              fill
              className="object-cover opacity-60 transition duration-700 hover:scale-105"
              sizes="100vw"
            />
          )}
          <div className="absolute inset-0 bg-linear-to-t from-stone-900 via-stone-900/40 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-stone-100 backdrop-blur-sm">
              <MapPin className="size-3" /> Your appointment
            </span>
            <p className="mt-2 text-xl font-bold leading-tight text-white">
              {branch.name}
            </p>
            <p className="text-xs text-stone-300">{branch.city}</p>
          </div>
        </div>

        {/* Detail grid with icons */}
        <div className="grid grid-cols-1 gap-px bg-white/5 sm:grid-cols-2">
          <DetailCell icon={Scissors} label={services.length === 1 ? "Service" : "Services"}>
            {services.length === 1 ? (
              <span>{services[0].name}</span>
            ) : (
              <ul className="space-y-1">
                {services.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3">
                    <span>{s.name}</span>
                    <span className="text-xs font-normal text-stone-400">₹{s.price.toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ul>
            )}
          </DetailCell>
          <DetailCell icon={User} label="Stylist">
            {worker ? (
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex size-6 items-center justify-center rounded-full bg-stone-700 text-[10px] font-bold text-stone-100">
                  {initials}
                </span>
                <span>{workerName(worker)}</span>
                {worker.reviewCount > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-xs font-normal text-stone-400">
                    <Star className="size-3 fill-stone-300 text-stone-300" />
                    {worker.averageRating.toFixed(1)}
                  </span>
                )}
              </span>
            ) : (
              <span className="text-stone-400">Any available stylist</span>
            )}
          </DetailCell>
          <DetailCell icon={CalendarDays} label="Date" value={fmtDate(date)} />
          <DetailCell
            icon={Clock}
            label="Time"
            value={`${slot} – ${end}`}
            sub={`${totalDuration} min`}
          />
        </div>

        {/* Perforated divider — gives the card a "ticket" feel */}
        <div className="relative py-1">
          <span className="absolute -left-2.5 top-1/2 size-5 -translate-y-1/2 rounded-full bg-stone-950" />
          <div className="mx-5 border-t border-dashed border-white/15" />
          <span className="absolute -right-2.5 top-1/2 size-5 -translate-y-1/2 rounded-full bg-stone-950" />
        </div>

        {/* Total */}
        <div className="flex items-end justify-between px-5 pb-5 pt-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-500">
              Total payable
            </p>
            <p className="mt-0.5 text-xs text-stone-500">Pay at the salon</p>
          </div>
          <p className="text-3xl font-bold tracking-tight text-stone-50">
            {priceStr}
          </p>
        </div>
      </div>

      {/* Trust strip */}
      <div className="mb-5 grid grid-cols-3 gap-2">
        {[
          { icon: ShieldCheck, label: "Free cancellation" },
          { icon: Wallet, label: "Pay at salon" },
          { icon: BadgeCheck, label: "Instant confirm" },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/8 bg-stone-900/60 px-2 py-3 text-center"
          >
            <Icon className="size-4 text-emerald-300/80" />
            <span className="text-[11px] font-medium leading-tight text-stone-400">
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Notes */}
      <label className="mb-4 block">
        <span className="mb-1.5 block text-xs font-medium text-stone-400">
          Special requests <span className="text-stone-600">(optional)</span>
        </span>
        <textarea
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          placeholder="Anything your stylist should know? Preferred length, allergies…"
          rows={2}
          className="w-full resize-none rounded-2xl border border-white/8 bg-stone-900 px-4 py-3 text-sm text-stone-200 placeholder:text-stone-600 focus:border-stone-300/40 focus:outline-none"
        />
      </label>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <button
        onClick={onConfirm}
        disabled={loading}
        className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-100 py-4 text-base font-bold text-stone-950 transition hover:bg-white active:scale-[0.98] disabled:opacity-60"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {loading ? "Booking…" : "Confirm Appointment"}
        {!loading && (
          <ChevronRight className="size-5 transition group-hover:translate-x-0.5" />
        )}
      </button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-stone-600">
        <ShieldCheck className="size-3.5" />
        Secured booking · No charge until you visit
      </p>
    </div>
  );
}

function DetailCell({
  icon: Icon,
  label,
  value,
  sub,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-stone-900 px-5 py-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-stone-500">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold text-stone-100">
        {children ?? value}
        {sub && (
          <span className="ml-1.5 text-xs font-normal text-stone-500">
            ({sub})
          </span>
        )}
      </div>
    </div>
  );
}

/* ── inline phone-OTP (shown when confirming while signed out) ───────────────── */
function InlineAuth({
  phase,
  name,
  onName,
  phone,
  onPhone,
  otp,
  onOtp,
  devOtp,
  loading,
  error,
  onSend,
  onVerify,
  onBack,
  onGoogle,
  googleLoading,
}: {
  phase: "phone" | "code";
  name: string;
  onName: (v: string) => void;
  phone: string;
  onPhone: (v: string) => void;
  otp: string;
  onOtp: (v: string) => void;
  devOtp: string | null;
  loading: boolean;
  error: string | null;
  onSend: () => void;
  onVerify: () => void;
  onBack: () => void;
  onGoogle: (credential: string) => void;
  googleLoading: boolean;
}) {
  const inputCls =
    "w-full rounded-2xl border border-white/8 bg-stone-900 px-4 py-3 text-sm text-stone-200 placeholder:text-stone-600 focus:border-stone-300/40 focus:outline-none";
  const btnCls =
    "flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-100 py-3.5 text-sm font-bold text-stone-950 transition hover:bg-stone-200 disabled:opacity-60";
  return (
    <div className="mt-6 rounded-2xl border border-stone-300/20 bg-stone-900/70 p-5">
      <h3 className="text-base font-semibold text-white">Sign in to confirm</h3>
      <p className="mt-1 text-sm text-stone-400">
        {phase === "phone"
          ? "Enter your mobile number — we'll send a one-time code to secure your booking."
          : "Enter the code we just sent."}
      </p>
      {error && (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {phase === "phone" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
          className="mt-4 space-y-3"
        >
          <input
            type="text"
            value={name}
            onChange={(e) => onName(e.target.value)}
            placeholder="Full name"
            autoFocus
            className={inputCls}
          />
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => onPhone(e.target.value)}
            placeholder="Mobile number"
            className={inputCls}
          />
          <button type="submit" disabled={loading} className={btnCls}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Sending…" : "Send code"}
          </button>

          {GOOGLE_ENABLED && (
            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-stone-600">
                  or
                </span>
                <span className="h-px flex-1 bg-white/10" />
              </div>
              <GoogleLoginButton loading={googleLoading} onCredential={onGoogle} />
              <p className="text-center text-[11px] text-stone-600">
                Continue with Google — no code needed
              </p>
            </div>
          )}
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onVerify();
          }}
          className="mt-4 space-y-3"
        >
          <p className="text-sm text-stone-300">
            Code sent to <span className="font-medium text-white">{phone}</span>
          </p>
          <input
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => onOtp(e.target.value.replace(/\D/g, ""))}
            placeholder="6-digit code"
            autoFocus
            className={`${inputCls} text-center font-mono text-lg tracking-[0.4em] placeholder:tracking-normal`}
          />
          {devOtp && (
            <p className="text-center text-xs text-stone-500">
              Dev code:{" "}
              <span className="font-mono font-semibold text-stone-200">
                {devOtp}
              </span>
            </p>
          )}
          <button type="submit" disabled={loading} className={btnCls}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? "Confirming…" : "Verify & confirm booking"}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="w-full text-center text-xs text-stone-500 transition hover:text-stone-300"
          >
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
    initialBranch && initialService
      ? "worker"
      : initialBranch
        ? "service"
        : "branch";

  const [step, setStep] = React.useState<Step>(initStep);
  const [branch, setBranch] = React.useState<PreloadedBranch | null>(
    initialBranch,
  );
  const [services, setServices] = React.useState<PreloadedService[]>(
    initialService ? [initialService] : [],
  );
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
  const [googleLoading, setGoogleLoading] = React.useState(false);

  function resetWorker() {
    setWorker(null);
    setWorkerChosen(false);
  }

  async function handleConfirm() {
    if (!branch || services.length === 0 || !date || !slot) return;
    const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
    setConfirmLoading(true);
    setConfirmError(null);
    try {
      const res = await fetch(API.customer.appointments, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          branchId: branch.id,
          // Omitted entirely when the customer picked "any stylist".
          ...(worker ? { workerId: worker.id } : {}),
          services: services.map((s) => ({ serviceId: s.id })),
          appointmentDate: date,
          startTime: slot,
          endTime: endTime(slot, totalDuration),
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (res.status === 401 || res.status === 403) {
        // Signed out or using a non-customer session — authenticate inline via
        // phone OTP, then retry this booking.
        setNeedsAuth(true);
        setConfirmError(null);
        return;
      }
      if (!res.ok)
        throw new Error(json?.error ?? json?.message ?? "Booking failed");
      router.push(`/customer/bookings/${json.data?.id ?? ""}`);
    } catch (e) {
      setConfirmError(
        e instanceof Error ? e.message : "Booking failed. Please try again.",
      );
    } finally {
      setConfirmLoading(false);
    }
  }

  // Step 1 of inline auth: send a one-time code to the entered phone.
  async function sendOtp() {
    if (!custName.trim()) {
      setAuthError("Enter your name");
      return;
    }
    const p = phone.trim();
    if (!p) {
      setAuthError("Enter your mobile number");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(API.auth.otpSend, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: p }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false)
        throw new Error(json?.message ?? "Could not send code");
      setDevOtp(json?.data?.devOtp ?? null);
      setAuthPhase("code");
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Could not send code");
    } finally {
      setAuthLoading(false);
    }
  }

  // Step 2: verify the code (auto-registers a customer if new), then complete the
  // booking. The verify response sets the session cookie, so handleConfirm's retry
  // is authenticated.
  async function verifyAndBook() {
    const code = otp.trim();
    if (!code) {
      setAuthError("Enter the 6-digit code");
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(API.auth.otpVerify, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          otp: code,
          firstName: custName.trim(),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false || !json?.data)
        throw new Error(json?.message ?? "Invalid code");
      setNeedsAuth(false);
      await handleConfirm();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setAuthLoading(false);
    }
  }

  // Alternative inline auth: "Continue with Google". Trades the Google ID token
  // for the same session cookie (auto-registers a customer if new), then retries
  // the booking — no OTP round-trip.
  async function handleGoogleBook(credential: string) {
    setGoogleLoading(true);
    setAuthError(null);
    try {
      const res = await fetch(API.auth.google, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.success === false || !json?.data)
        throw new Error(json?.message ?? "Google sign-in failed");
      setNeedsAuth(false);
      await handleConfirm();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <StepBar current={step} />

        <BookingBar
          branch={branch}
          services={services}
          worker={worker}
          workerChosen={workerChosen}
          date={date}
          slot={slot}
          onChangeBranch={() => {
            setBranch(null);
            setServices([]);
            resetWorker();
            setDate("");
            setSlot("");
            setStep("branch");
          }}
          onChangeService={() => {
            setServices([]);
            resetWorker();
            setDate("");
            setSlot("");
            setStep("service");
          }}
          onChangeWorker={() => {
            resetWorker();
            setDate("");
            setSlot("");
            setStep("worker");
          }}
          onChangeSlot={() => {
            setDate("");
            setSlot("");
            setStep("slot");
          }}
        />

        {step === "branch" && (
          <BranchStep
            onSelect={(b) => {
              setBranch(b);
              setServices([]);
              resetWorker();
              setDate("");
              setSlot("");
              setStep("service");
            }}
          />
        )}

        {step === "service" && branch && (
          <>
            <button
              onClick={() => {
                setBranch(null);
                setStep("branch");
              }}
              className="mb-4 flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-300 transition"
            >
              <ChevronLeft className="size-4" /> Change branch
            </button>
            <ServiceStep
              branchId={branch.id}
              selected={services}
              onToggle={(s) => {
                setServices((prev) =>
                  prev.some((p) => p.id === s.id)
                    ? prev.filter((p) => p.id !== s.id)
                    : [...prev, s],
                );
              }}
              onContinue={() => {
                if (services.length === 0) return;
                resetWorker();
                setDate("");
                setSlot("");
                setStep("worker");
              }}
            />
          </>
        )}

        {step === "worker" && branch && services.length > 0 && (
          <>
            <button
              onClick={() => {
                setServices([]);
                resetWorker();
                setStep("service");
              }}
              className="mb-4 flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-300 transition"
            >
              <ChevronLeft className="size-4" /> Change services
            </button>
            <WorkerStep
              branchId={branch.id}
              serviceId={services[0].id}
              serviceName={services.length === 1 ? services[0].name : services.map((s) => s.name).join(" + ")}
              onSelect={(w) => {
                setWorker(w);
                setWorkerChosen(true);
                setDate("");
                setSlot("");
                setStep("slot");
              }}
            />
          </>
        )}

        {step === "slot" && branch && services.length > 0 && (
          <>
            <button
              onClick={() => {
                resetWorker();
                setDate("");
                setSlot("");
                setStep("worker");
              }}
              className="mb-4 flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-300 transition"
            >
              <ChevronLeft className="size-4" /> Change worker
            </button>
            <SlotStep
              branch={branch}
              services={services}
              worker={worker}
              onSelect={(d, s) => {
                setDate(d);
                setSlot(s);
                setStep("confirm");
              }}
            />
          </>
        )}

        {step === "confirm" && branch && services.length > 0 && date && slot && (
          <>
            <button
              onClick={() => {
                setDate("");
                setSlot("");
                setStep("slot");
              }}
              className="mb-4 flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-300 transition"
            >
              <ChevronLeft className="size-4" /> Change time
            </button>
            <div className="grid gap-6 lg:grid-cols-[1.3fr_420px]">
              <ConfirmStep
                branch={branch}
                services={services}
                worker={worker}
                date={date}
                slot={slot}
                notes={notes}
                onNotes={setNotes}
                onConfirm={handleConfirm}
                loading={confirmLoading}
                error={confirmError}
              />
              {needsAuth && (
                <div className="sticky top-24 self-start rounded-3xl border border-white/10 bg-stone-900 p-5">
                  <InlineAuth
                    phase={authPhase}
                    name={custName}
                    onName={setCustName}
                    phone={phone}
                    onPhone={setPhone}
                    otp={otp}
                    onOtp={setOtp}
                    devOtp={devOtp}
                    loading={authLoading}
                    error={authError}
                    onSend={sendOtp}
                    onVerify={verifyAndBook}
                    onGoogle={handleGoogleBook}
                    googleLoading={googleLoading}
                    onBack={() => {
                      setAuthPhase("phone");
                      setOtp("");
                      setAuthError(null);
                    }}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
