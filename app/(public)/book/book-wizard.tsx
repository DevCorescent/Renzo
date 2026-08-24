"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { API } from "@/lib/endpoints";
import {
  MapPin,
  Scissors,
  Clock,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Check,
  Loader2,
  CalendarDays,
  Search,
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
import { BookingDatePicker } from "./date-picker";
import { fmtDate, fmtDateShort, today } from "./date-utils";
import { resolveOpenState, type DayTiming } from "@/lib/branch-hours";
import {
  GoogleLoginButton,
  GOOGLE_ENABLED,
} from "@/components/shared/google-login-button";

/* ── shared types (exported for use in server page) ────────────────────────── */

/** Exactly what POST /api/v1/public/appointments returns. */
export type BookedAppointment = {
  id: string;
  appointmentNo: string;
  status: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  branch: { name: string; address: string | null; phone: string | null } | null;
  worker: { firstName: string; lastName: string | null } | null;
  services: { name: string; price: number }[];
  customer: { firstName: string; lastName: string | null; phone: string | null };
};

export type PreloadedBranch = {
  id: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  coverImage: string | null;
  // Present on branches fetched from /public/branches — drives the open/closed
  // badge. Optional because the server-preloaded branch (page.tsx) never renders
  // a card, so it does not pay for the join.
  timings?: DayTiming[];
  holidays?: { date: string }[];
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
  description?: string | null;
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

// `today`, `addDays`, `fmtDate` and friends now live in ./date-utils, which
// works in local calendar days instead of UTC instants — see the note there.

function endTime(start: string, mins: number) {
  const [h, m] = start.split(":").map(Number);
  const t = h * 60 + m + mins;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

const SERVICE_CATEGORY_PLACEHOLDER: Record<string, string> = {
  hair: "https://images.unsplash.com/photo-1542831371-d531d36971e6?auto=format&fit=crop&w=900&q=80",
  nails:
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=900&q=80",
  skin: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=80",
  "hair care":
    "https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?auto=format&fit=crop&w=900&q=80",
};

/**
 * The image to show on a service card.
 *
 * The service's own uploaded image wins. This used to key off the category name
 * alone and always returned a stock photo, so images uploaded through the admin
 * never appeared here even though they were stored and served correctly — the
 * category placeholder is only the fallback for services with no image yet.
 */
function getServiceCardImage(service: { image: string | null; category: { name: string } }) {
  const own = service.image?.trim();
  if (own) return own;
  return (
    SERVICE_CATEGORY_PLACEHOLDER[service.category.name.toLowerCase()] ??
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

function serviceMatchesQuery(service: ApiService, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    service.name,
    service.description,
    service.category.name,
    getServiceDescription(service),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

/** Audience filter on the service step. UNISEX stays visible for both Men and Women. */
type GenderFilter = "ALL" | "MALE" | "FEMALE";

function serviceMatchesGender(service: ApiService, filter: GenderFilter) {
  if (filter === "ALL") return true;
  return service.gender === filter || service.gender === "UNISEX";
}

/** How far ahead the salon accepts bookings, in days from today. */
const MAX_ADVANCE_DAYS = 90;

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
  className,
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
  className?: string;
}) {
  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
  if (!branch && services.length === 0) return null;

  // Chips truncate instead of growing: a long branch name used to set the
  // intrinsic width of the whole column and push the layout past the viewport.
  const chipCls =
    "group flex min-w-0 max-w-full items-center gap-2 rounded-xl bg-stone-800 px-2.5 py-2 text-left transition hover:bg-stone-700 sm:px-3";
  const labelCls = "min-w-0 truncate text-xs font-medium text-stone-200";

  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-2 rounded-2xl border border-white/8 bg-stone-900/80 p-2.5 sm:p-3 ${className ?? "mb-6"}`}>
      {branch && (
        <button onClick={onChangeBranch} className={chipCls} title={branch.name}>
          <MapPin className="size-3.5 shrink-0 text-stone-400" />
          <span className={labelCls}>{branch.name}</span>
          <X className="size-3 shrink-0 text-stone-600 group-hover:text-red-400 transition" />
        </button>
      )}
      {services.length > 0 && (
        <button onClick={onChangeService} className={chipCls}>
          <Scissors className="size-3.5 shrink-0 text-stone-400" />
          <span className={labelCls}>
            {services.length === 1 ? services[0].name : `${services.length} services`}
          </span>
          <span className="shrink-0 text-xs font-semibold text-stone-100">
            ₹{totalPrice.toLocaleString("en-IN")}
          </span>
          <X className="size-3 shrink-0 text-stone-600 group-hover:text-red-400 transition" />
        </button>
      )}
      {workerChosen && (
        <button onClick={onChangeWorker} className={chipCls}>
          <User className="size-3.5 shrink-0 text-stone-400" />
          <span className={labelCls}>
            {worker ? workerName(worker) : "Any worker"}
          </span>
          <X className="size-3 shrink-0 text-stone-600 group-hover:text-red-400 transition" />
        </button>
      )}
      {slot && (
        <button onClick={onChangeSlot} className={chipCls}>
          <Clock className="size-3.5 shrink-0 text-stone-400" />
          <span className={labelCls}>
            {fmtDateShort(date)}, {slot}
          </span>
          <X className="size-3 shrink-0 text-stone-600 group-hover:text-red-400 transition" />
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

function StepBar({ current, className }: { current: Step; className?: string }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div
      className={`flex min-w-0 items-center gap-1 ${className ?? "mb-6 sm:mb-8"}`}
      role="group"
      aria-label={`Step ${idx + 1} of ${STEPS.length}: ${STEPS[idx]?.label ?? ""}`}
    >
      {STEPS.map((s, i) => (
        <React.Fragment key={s.key}>
          <div className="flex min-w-0 items-center gap-1.5">
            {/* Completed → green check. Current → filled (white on this dark
                shell, the dark-mode reading of the spec's "black filled"). Upcoming
                → outlined gray. */}
            <span
              className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition duration-200 ease-out sm:size-8 ${
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
              className={`hidden whitespace-nowrap text-xs font-medium sm:inline transition duration-200 ${
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

const STEP_HINTS: Record<Step, string> = {
  branch: "Choose a branch",
  service: "Pick one or more services",
  worker: "Choose your preferred stylist",
  slot: "Pick a convenient slot",
  confirm: "Review & confirm booking",
};

function BookingProgressPanel({
  current,
  branch,
  services,
}: {
  current: Step;
  branch: PreloadedBranch | null;
  services: PreloadedService[];
}) {
  const idx = STEPS.findIndex((s) => s.key === current);
  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
  const details: Record<Step, string> = {
    branch: branch?.name ?? STEP_HINTS.branch,
    service:
      services.length === 0
        ? STEP_HINTS.service
        : services.length === 1
          ? `${services[0].name} ₹${services[0].price.toLocaleString("en-IN")}`
          : `${services.length} services ₹${totalPrice.toLocaleString("en-IN")}`,
    worker: STEP_HINTS.worker,
    slot: STEP_HINTS.slot,
    confirm: STEP_HINTS.confirm,
  };

  return (
    <aside className="flex h-full flex-col rounded-3xl border border-white/10 bg-stone-900/85 p-5">
      <h3 className="mb-5 text-sm font-semibold text-stone-100">
        Your booking progress
      </h3>
      <ol className="min-h-0 flex-1">
        {STEPS.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className={`absolute left-[0.9375rem] top-8 h-[calc(100%-0.5rem)] w-px ${
                    done ? "bg-stone-500" : "bg-white/10"
                  }`}
                />
              )}
              <span
                className={`relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                  done
                    ? "border-stone-200 bg-stone-100 text-stone-950"
                    : active
                      ? "border-white bg-white text-stone-950 ring-2 ring-stone-300/40"
                      : "border-stone-700/70 bg-transparent text-stone-500"
                }`}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <p
                  className={`text-sm ${
                    active
                      ? "font-semibold text-stone-100"
                      : done
                        ? "font-medium text-stone-200"
                        : "text-stone-500"
                  }`}
                >
                  {s.label}
                </p>
                <p className="mt-0.5 truncate text-xs text-stone-500">{details[s.key]}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-auto flex items-start gap-2 rounded-2xl border border-white/10 bg-stone-950/60 px-3 py-3">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-stone-400" aria-hidden />
        <div>
          <p className="text-xs font-medium text-stone-200">Secured booking</p>
          <p className="text-[11px] text-stone-500">No charge until you visit</p>
        </div>
      </div>
    </aside>
  );
}

/* ── step 1: branch ─────────────────────────────────────────────────────────── */

function BranchStep({ onSelect }: { onSelect: (b: ApiBranch) => void }) {
  const [branches, setBranches] = React.useState<ApiBranch[]>([]);
  const [loading, setLoading] = React.useState(true);
  // Clock for the open/closed badges, ticking once a minute. Safe as a lazy
  // initial value: on the server this step renders the loading spinner, so no
  // badge is ever part of the SSR output for hydration to disagree with.
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    fetch(`${API.public.branches}?limit=50`)
      .then((r) => r.json())
      .then((j) => setBranches(j.data?.items ?? j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
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
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
          {branches.map((b, index) => {
            const distance = `${(2.4 + index * 0.3).toFixed(1)} km away`;
            // Real state from the branch's saved hours (salon-local time, today's
            // holiday included), recomputed every minute by the tick above so a
            // parked tab flips at opening/closing time instead of going stale.
            const hours = resolveOpenState(b.timings, (b.holidays?.length ?? 0) > 0, now);
            const isOpen = hours.status === "OPEN";
            return (
              <button
                key={b.id}
                onClick={() => onSelect(b)}
                className="group flex flex-col gap-3 overflow-hidden rounded-3xl border border-white/10 bg-stone-900/95 p-4 text-left shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_50px_-36px_rgba(255,255,255,0.22)] hover:border-stone-300/50 hover:bg-stone-800 sm:gap-4 sm:p-5"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-stone-800 ring-1 ring-white/10 sm:size-20 sm:rounded-3xl">
                    {b.coverImage ? (
                      <Image
                        src={b.coverImage}
                        alt={b.name}
                        fill
                        className="object-cover opacity-90 transition group-hover:opacity-100"
                        sizes="(max-width: 640px) 64px, 80px"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-stone-600 text-xl font-bold opacity-40">
                        {b.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold break-words text-stone-100 transition group-hover:text-stone-50 sm:text-base">
                      {b.name}
                    </p>
                    <p className="mt-1 text-xs break-words text-stone-400 sm:text-sm">
                      {b.city} · {b.address}
                    </p>
                  </div>
                </div>
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap gap-1.5 text-[11px] text-stone-300 sm:gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-stone-800/80 px-2.5 py-1 font-medium sm:px-3">
                      {distance}
                    </span>
                    <span
                      className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 font-medium sm:gap-2 sm:px-3 ${isOpen ? "bg-emerald-500/10 text-emerald-200" : "bg-stone-800 text-stone-400"}`}
                    >
                      <span
                        className={`size-2 shrink-0 rounded-full sm:size-2.5 ${isOpen ? "bg-emerald-400" : "bg-stone-500"}`}
                      />
                      {hours.label}
                      {hours.detail && (
                        <span className="min-w-0 truncate font-normal text-stone-400">
                          · {hours.detail}
                        </span>
                      )}
                    </span>
                  </div>
                  <ChevronRight className="size-4 shrink-0 text-stone-500 transition group-hover:text-stone-200" />
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
  const [query, setQuery] = React.useState("");
  const [genderFilter, setGenderFilter] = React.useState<GenderFilter>("ALL");

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
  const services = React.useMemo(
    () => (result?.key === branchId ? result.items : []),
    [result, branchId],
  );
  const filteredServices = React.useMemo(
    () =>
      services.filter(
        (s) => serviceMatchesQuery(s, query) && serviceMatchesGender(s, genderFilter),
      ),
    [services, query, genderFilter],
  );

  // Group by category
  const groupMap = new Map<string, { name: string; items: ApiService[] }>();
  for (const s of filteredServices) {
    if (!groupMap.has(s.category.name))
      groupMap.set(s.category.name, { name: s.category.name, items: [] });
    groupMap.get(s.category.name)!.items.push(s);
  }
  const grouped = Array.from(groupMap.values());
  const hasQuery = query.trim().length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Heading on its own line, then one full-width search row with the CTA
          beside it. The search box used to be squeezed into the middle of a
          three-way justify-between, so it was both narrow and visually adrift
          from the results it filters. */}
      <div className="sticky top-24 z-20 shrink-0 bg-stone-950 pb-4 lg:static lg:top-auto">
        <div className="mb-3 min-w-0">
          <h2 className="mb-1 text-lg font-semibold">Select services</h2>
          <p className="text-sm text-stone-400">
            Pick one or more services for your visit
          </p>
        </div>

        <div
          className="mb-3 flex flex-wrap gap-2"
          role="group"
          aria-label="Filter services by audience"
        >
          {(
            [
              { value: "ALL", label: "All" },
              { value: "MALE", label: "Men" },
              { value: "FEMALE", label: "Women" },
            ] as const
          ).map((opt) => {
            const active = genderFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGenderFilter(opt.value)}
                aria-pressed={active}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "bg-stone-700 text-white"
                    : "border border-stone-700/80 bg-transparent text-stone-400 hover:border-stone-500 hover:text-stone-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search services</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-stone-500"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search services or categories…"
              className="h-11 w-full rounded-2xl border border-white/10 bg-stone-900 pl-10 pr-9 text-base text-stone-100 placeholder:text-stone-500 outline-none transition focus:border-stone-400/40 sm:text-sm"
            />
            {hasQuery && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-stone-500 transition hover:bg-white/10 hover:text-stone-200"
              >
                <X className="size-3.5" />
              </button>
            )}
          </label>

          {selected.length > 0 && (
            <button
              type="button"
              onClick={onContinue}
              className="hidden h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-bold text-stone-950 transition hover:bg-stone-200 active:scale-[0.98] lg:inline-flex"
            >
              <CalendarDays className="size-4 shrink-0" />
              Book Selected ({selected.length})
            </button>
          )}
        </div>

        {selected.length > 0 && (
          <p className="mt-2 text-xs leading-snug text-stone-500">
            Review your selection and choose date, time &amp; branch
          </p>
        )}
        {(hasQuery || genderFilter !== "ALL") && !loading && (
          <p className="mt-2 text-xs text-stone-500">
            {filteredServices.length} result
            {filteredServices.length === 1 ? "" : "s"}
            {hasQuery ? <> for &ldquo;{query.trim()}&rdquo;</> : null}
            {genderFilter === "MALE"
              ? " for men"
              : genderFilter === "FEMALE"
                ? " for women"
                : null}
          </p>
        )}
      </div>
      <div className="@container min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-stone-600" />
        </div>
      ) : services.length === 0 ? (
        <p className="py-16 text-center text-stone-500">
          No services listed at this branch yet.
        </p>
      ) : grouped.length === 0 ? (
        <p className="py-16 text-center text-stone-500">
          {hasQuery
            ? "No services found"
            : genderFilter === "MALE"
              ? "No men's services listed at this branch yet."
              : genderFilter === "FEMALE"
                ? "No women's services listed at this branch yet."
                : "No services listed at this branch yet."}
        </p>
      ) : (
        <div className="space-y-5 pb-32 lg:pb-2">
          {grouped.map(({ name: cat, items }) => (
            <div key={cat}>
              <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-stone-500">
                {cat}
              </p>
              <div className="grid grid-cols-1 gap-3 @[22rem]:grid-cols-2 @[40rem]:grid-cols-3 @[58rem]:grid-cols-4">
                {items.map((s) => {
                  const price = s.branchPricings?.[0]?.price ?? s.basePrice;
                  const isSelected = selectedIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onToggle({ ...s, price })}
                      className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border text-left shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_20px_60px_-36px_rgba(255,255,255,0.2)] ${
                        isSelected
                          ? "border-stone-200/60 bg-stone-800 ring-1 ring-stone-300/30"
                          : "border-white/10 bg-stone-900 hover:border-stone-300/50"
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute right-2.5 top-2.5 z-10 inline-flex size-6 items-center justify-center rounded-full bg-white text-stone-950 shadow">
                          <Check className="size-3.5" />
                        </span>
                      )}
                      <div className="relative aspect-video overflow-hidden bg-stone-800">
                        <Image
                          src={getServiceCardImage(s)}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
                          className="object-cover transition duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-linear-to-t from-stone-950/85 via-stone-950/20 to-transparent" />
                      </div>
                      <div className="flex flex-1 flex-col gap-2 px-3.5 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-semibold text-stone-100">
                            {s.name}
                          </p>
                          <span className="shrink-0 text-sm font-semibold text-stone-100">
                            ₹{price.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-xs leading-5 text-stone-400">
                          {getServiceDescription(s)}
                        </p>
                        <div className="mt-auto flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wide text-stone-500">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
                            {s.duration} min
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-stone-400">
                            {cat}
                          </span>
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
      </div>
      {selected.length > 0 && (
        <button
          type="button"
          onClick={onContinue}
          aria-label={`Book selected (${selected.length})`}
          className="fixed right-5 z-50 flex size-12 items-center justify-center rounded-full bg-white text-black shadow-lg shadow-black/40 transition hover:bg-gray-100 active:scale-[0.98] lg:hidden bottom-[calc(5rem+env(safe-area-inset-bottom,0px))]"
        >
          <ArrowRight className="size-5" />
          <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-stone-950 px-1 text-[10px] font-bold leading-5 text-white ring-2 ring-white">
            {selected.length}
          </span>
        </button>
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
  serviceIds,
  serviceName,
  onSelect,
}: {
  branchId: string;
  serviceIds: string[];
  serviceName: string;
  onSelect: (worker: ApiWorker | null) => void;
}) {
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    key: string;
    items: ApiWorker[];
    error: string | null;
  } | null>(null);

  const serviceKey = serviceIds.join(",");
  const key = `${branchId}|${serviceKey}`;

  React.useEffect(() => {
    let cancelled = false;
    const ids = serviceKey.split(",").filter(Boolean);

    // Server filters via WorkerService: only stylists at this branch who
    // offer EVERY selected service are returned.
    const params = new URLSearchParams({
      branchId,
      date: today(),
      limit: "50",
    });
    for (const id of ids) params.append("serviceIds", id);

    fetch(`${API.public.workers}?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (!j.success) throw new Error(j.message ?? "Could not load stylists");
        setResult({
          key: `${branchId}|${serviceKey}`,
          items: j.data?.items ?? [],
          error: null,
        });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setResult({
          key: `${branchId}|${serviceKey}`,
          items: [],
          error: e instanceof Error ? e.message : "Could not load stylists",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [branchId, serviceKey]);

  const fresh = result?.key === key ? result : null;
  const loading = fresh === null;
  const error = fresh?.error ?? null;
  const workers = fresh?.items ?? [];

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Choose your stylist</h2>
      <p className="mb-5 text-sm text-stone-400">
        Only workers who perform all selected services at this branch are shown
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {/* Any-stylist option keeps the original "book without picking" path. */}
          <button
            onClick={() => onSelect(null)}
            className="group flex h-full min-w-0 flex-col justify-between rounded-3xl border border-white/10 bg-stone-950/80 p-4 text-left shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_20px_60px_-36px_rgba(255,255,255,0.18)] hover:bg-stone-900 sm:p-6"
          >
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-stone-800 text-2xl text-stone-400 sm:size-14">
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
            <div className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-stone-900 px-3 py-2 text-xs font-semibold text-stone-200 sm:mt-6">
              <Clock className="size-4 shrink-0 text-stone-400" />
              Available today · next 10:00
            </div>
          </button>

          {workers.length === 0 ? (
            <p className="rounded-2xl border border-white/8 bg-stone-900 px-4 py-10 text-center text-sm text-stone-500 sm:col-span-1 xl:col-span-2">
              No stylists are available for the selected services.
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
                  className="min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-stone-900 shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_20px_60px_-36px_rgba(255,255,255,0.16)] hover:border-stone-300/50"
                >
                  <div className="p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="relative size-14 shrink-0 overflow-hidden rounded-full bg-stone-800 ring-1 ring-white/10 sm:size-16">
                        {w.profilePhoto ? (
                          <Image
                            src={w.profilePhoto}
                            alt={workerName(w)}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 56px, 64px"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-stone-500">
                            <User className="size-6" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="min-w-0 max-w-full truncate font-semibold text-stone-100">
                            {workerName(w)}
                          </p>
                          {w.reviewCount > 0 ? (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-stone-800 px-2 py-0.5 text-[11px] font-medium text-stone-200">
                              <Star className="size-3 shrink-0 fill-stone-100 text-stone-100" />
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

                    <div className="mt-4 flex items-center gap-2 sm:gap-3">
                      <button
                        onClick={() => setExpanded(isOpen ? null : w.id)}
                        aria-expanded={isOpen}
                        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-white/12 bg-stone-950 px-3 py-2 text-xs font-semibold text-stone-200 transition hover:border-white/25 hover:bg-white/5 sm:flex-none sm:px-4"
                      >
                        {isOpen ? "Hide portfolio" : "Portfolio"}
                      </button>
                      <button
                        onClick={() => onSelect(w)}
                        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-white px-3 py-2 text-xs font-bold text-stone-950 transition hover:bg-stone-200 active:scale-[0.98] sm:flex-none sm:px-6"
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
  const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
  const serviceIdKey = services.map((s) => s.id).join(",");
  const [selectedDate, setSelectedDate] = React.useState(() => today());
  const [result, setResult] = React.useState<{
    key: string;
    slots: string[];
    slotGrid: Array<{ time: string; status: "AVAILABLE" | "BOOKED" | "PAST" }>;
    msg: string | null;
  } | null>(null);

  const key = `${branch.id}|${serviceIdKey}|${worker?.id ?? ""}|${selectedDate}`;

  React.useEffect(() => {
    let cancelled = false;

    // ALL selected services go to the API. It sizes each slot by their summed
    // duration — asking for only the first one offered slots too short to hold
    // the booking, which POST /appointments would then reject.
    //
    // With a workerId the API returns ONLY that stylist's free slots, so one
    // stylist's bookings never remove slots from another's schedule.
    const q = new URLSearchParams({
      branchId: branch.id,
      serviceIds: serviceIdKey,
      date: selectedDate,
    });
    if (worker) q.set("workerId", worker.id);
    const reqKey = `${branch.id}|${serviceIdKey}|${worker?.id ?? ""}|${selectedDate}`;

    fetch(`${API.public.slots}?${q.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const list: string[] = j.data?.slots ?? [];
        const grid: Array<{ time: string; status: "AVAILABLE" | "BOOKED" | "PAST" }> =
          j.data?.slotGrid ?? list.map((time: string) => ({ time, status: "AVAILABLE" as const }));
        // An empty grid always has a specific reason — closed that day, no
        // qualified stylist, everyone on leave. Show the API's message rather
        // than flattening all of them to "no slots".
        const msg = !j.success
          ? (j.message ?? "Could not load slots")
          : grid.length === 0
            ? (j.message ?? "No slots available — try another date")
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
  }, [branch, serviceIdKey, worker, selectedDate]);

  const fresh = result?.key === key ? result : null;
  const loading = fresh === null;
  const slotGrid = fresh?.slotGrid ?? [];
  const msg = fresh?.msg ?? null;

  // Everything stays on screen: BOOKED so the customer sees the chair is taken,
  // PAST so today's earlier times read as "already gone" rather than silently
  // vanishing. Both are rendered disabled — only AVAILABLE is clickable.
  const visible = slotGrid;
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
  const pastCount = visible.filter((s) => s.status === "PAST").length;
  const bookedCount = visible.filter((s) => s.status === "BOOKED").length;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* min-w-0 stops the date strip's intrinsic width from sizing this column
          — without it the grid track grew to the full 14-chip width, the parent
          layout's overflow-x-hidden clipped the excess, and the strip could
          never scroll because it was never actually overflowing. */}
      <div className="min-w-0">
        <h2 className="mb-1 text-lg font-semibold">Pick a date &amp; time</h2>
        <p className="mb-4 text-sm text-stone-400 sm:mb-5">
          {worker
            ? "Showing only your stylist's free slots"
            : "Choose when you'd like to come in"}
        </p>

        <BookingDatePicker
          value={selectedDate}
          onChange={setSelectedDate}
          maxAdvanceDays={MAX_ADVANCE_DAYS}
          className="mb-5 sm:mb-6"
        />

        {/* Slots grid */}
        <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-stone-500">
          <CalendarDays className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">{fmtDate(selectedDate)}</span>
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
                {pastCount > 0 && bookedCount === 0
                  ? "Today's slots have all passed. Pick another date."
                  : "All remaining times are booked. Pick another date or stylist."}
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
                <div className="grid grid-cols-3 gap-2 min-[26rem]:grid-cols-4 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
                  {items.map((entry) => {
                    const open = entry.status === "AVAILABLE";
                    return (
                      <button
                        key={entry.time}
                        type="button"
                        disabled={!open}
                        title={
                          entry.status === "PAST"
                            ? "This time has already passed"
                            : entry.status === "BOOKED"
                              ? "Already booked"
                              : undefined
                        }
                        onClick={() => {
                          if (open) onSelect(selectedDate, entry.time);
                        }}
                        className={`rounded-2xl border px-2 py-3 text-sm font-medium tabular-nums transition duration-200 ease-out sm:px-4 sm:py-4 ${
                          open
                            ? "border-white/10 bg-stone-900 text-stone-300 hover:border-stone-300/50 hover:bg-stone-800 hover:text-stone-100 hover:shadow-[0_18px_50px_-36px_rgba(255,255,255,0.18)]"
                            : "cursor-not-allowed border-white/5 bg-stone-950/60 text-stone-600"
                        }`}
                      >
                        <span className={`block ${entry.status === "PAST" ? "line-through" : ""}`}>
                          {entry.time}
                        </span>
                        {!open && (
                          <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                            {entry.status === "PAST" ? "Past" : "Booked"}
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

      <aside className="min-w-0 rounded-3xl border border-white/10 bg-stone-900 p-4 text-sm text-stone-300 sm:p-5 lg:sticky lg:top-24 lg:self-start">
        <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-stone-500">
          Booking summary
        </p>
        <div className="space-y-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-stone-500">
              Branch
            </p>
            <p className="mt-2 font-semibold break-words text-stone-100">
              {branch.name}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-stone-500">
              {services.length === 1 ? "Service" : "Services"}
            </p>
            {services.map((s) => (
              <p key={s.id} className="mt-1 font-semibold break-words text-stone-100">
                {s.name}
              </p>
            ))}
            <p className="text-xs text-stone-500">{totalDuration} min total</p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-stone-500">
              Stylist
            </p>
            <p className="mt-2 font-semibold break-words text-stone-100">
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
  inlinePanel,
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
  /** Rendered above the confirm button on narrow screens, where the sidebar
      collapses below the fold and the customer would otherwise meet the
      "Confirm" button before the form it depends on. */
  inlinePanel?: React.ReactNode;
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
    <div className="min-w-0">
      {/* Heading */}
      <div className="mb-5 flex min-w-0 items-center gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0">
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
        <div className="relative h-28 w-full overflow-hidden bg-stone-800 sm:h-32">
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
          <div className="absolute bottom-3 left-4 right-4 sm:bottom-4 sm:left-5 sm:right-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-stone-100 backdrop-blur-sm">
              <MapPin className="size-3 shrink-0" /> Your appointment
            </span>
            <p className="mt-2 text-base font-bold leading-tight break-words text-white sm:text-xl">
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
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-stone-700 text-[10px] font-bold text-stone-100">
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
        <div className="flex items-end justify-between gap-3 px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-500">
              Total payable
            </p>
            <p className="mt-0.5 text-xs text-stone-500">Pay at the salon</p>
          </div>
          <p className="shrink-0 text-2xl font-bold tracking-tight text-stone-50 sm:text-3xl">
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

      {/* On lg+ this same panel lives in the sticky sidebar instead. */}
      {inlinePanel && <div className="mb-5 lg:hidden">{inlinePanel}</div>}

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
    <div className="min-w-0 bg-stone-900 px-4 py-3.5 sm:px-5 sm:py-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-stone-500">
        <Icon className="size-3.5 shrink-0" />
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold break-words text-stone-100">
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

/* ── guest details ────────────────────────────────────────────────────────────
   Rendered twice — once in the lg sidebar, once inline above the confirm button
   on narrow screens — so `idPrefix` keeps the label/input `id` pairs unique. */
function GuestDetailsPanel({
  idPrefix,
  name,
  onName,
  phone,
  onPhone,
  email,
  onEmail,
  showErrors,
  className,
}: {
  idPrefix: string;
  name: string;
  onName: (v: string) => void;
  phone: string;
  onPhone: (v: string) => void;
  email: string;
  onEmail: (v: string) => void;
  showErrors: boolean;
  className?: string;
}) {
  const inputCls =
    "mt-1 h-11 w-full rounded-xl border border-white/10 bg-stone-950 px-3 text-base text-white outline-none transition focus:border-white/30 sm:text-sm";

  return (
    <div
      className={`rounded-3xl border border-white/10 bg-stone-900 p-4 sm:p-5 ${className ?? ""}`}
    >
      <h3 className="text-sm font-medium text-white">Your details</h3>
      <p className="mt-1 text-xs text-white/50">
        No account needed — we only use this to confirm your appointment.
      </p>

      <label className="mt-4 block text-xs text-white/60" htmlFor={`${idPrefix}-name`}>
        Full name
      </label>
      <input
        id={`${idPrefix}-name`}
        value={name}
        onChange={(e) => onName(e.target.value)}
        placeholder="Priya Sharma"
        autoComplete="name"
        className={inputCls}
      />

      <label className="mt-3 block text-xs text-white/60" htmlFor={`${idPrefix}-phone`}>
        Mobile number
      </label>
      <input
        id={`${idPrefix}-phone`}
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={(e) => onPhone(e.target.value)}
        placeholder="9876543210"
        autoComplete="tel"
        className={inputCls}
      />

      <label className="mt-3 block text-xs text-white/60" htmlFor={`${idPrefix}-email`}>
        Email <span className="text-white/30">(optional)</span>
      </label>
      <input
        id={`${idPrefix}-email`}
        type="email"
        value={email}
        onChange={(e) => onEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        className={inputCls}
      />

      {showErrors && !name.trim() && (
        <p className="mt-2 text-xs text-rose-300">Please enter your name.</p>
      )}
      {showErrors && !phone.trim() && (
        <p className="mt-1 text-xs text-rose-300">
          Please enter your mobile number.
        </p>
      )}

      <p className="mt-4 border-t border-white/10 pt-3 text-xs text-white/40">
        Already have an account?{" "}
        <Link href="/login" className="text-white/70 underline">
          Sign in
        </Link>{" "}
        to see all your bookings — entirely optional.
      </p>
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
  /** Guest details panel — shown when name/phone are still missing at confirm. */
  const [needsDetails, setNeedsDetails] = React.useState(false);
  const [custEmail, setCustEmail] = React.useState("");
  /** Set once the booking succeeds; renders the confirmation in place. */
  const [booked, setBooked] = React.useState<BookedAppointment | null>(null);
  const [authPhase, setAuthPhase] = React.useState<"phone" | "code">("phone");
  const [custName, setCustName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [devOtp, setDevOtp] = React.useState<string | null>(null);
  const [authLoading, setAuthLoading] = React.useState(false);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = React.useState(false);

  const resetWorker = React.useCallback(() => {
    setWorker(null);
    setWorkerChosen(false);
  }, []);

  const selectedServiceKey = services.map((s) => s.id).join(",");

  // If the customer changes services after picking a stylist, drop that
  // stylist when WorkerService says they no longer offer the full set.
  React.useEffect(() => {
    const branchId = branch?.id;
    const workerId = worker?.id;
    const ids = selectedServiceKey.split(",").filter(Boolean);

    if (!branchId || ids.length === 0 || !workerChosen || !workerId) return;

    let cancelled = false;
    const params = new URLSearchParams({
      branchId,
      date: today(),
      limit: "50",
    });
    for (const id of ids) params.append("serviceIds", id);

    fetch(`${API.public.workers}?${params.toString()}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const items: Array<{ id: string }> = j.data?.items ?? [];
        if (items.some((w) => w.id === workerId)) return;
        resetWorker();
        setDate("");
        setSlot("");
        setStep((prev) =>
          prev === "slot" || prev === "confirm" ? "worker" : prev,
        );
      })
      .catch(() => {
        // Network failure must not fake compatibility. Keep the current
        // worker; POST /appointments still rejects an invalid pair.
      });

    return () => {
      cancelled = true;
    };
  }, [branch?.id, selectedServiceKey, worker?.id, workerChosen, resetWorker]);

  /**
   * Book as a GUEST.
   *
   * Posts to /api/v1/public/appointments, which needs no account. This used to
   * post to the CUSTOMER endpoint and treat its 401 as "show the login form",
   * which meant every public booking ended at a sign-in wall — the bug this
   * replaces. Sign-in is now genuinely optional, and offered AFTER the booking
   * is safely made.
   *
   * A branch that sets `requireLoginToBook` still answers 401; only then does the
   * wizard fall back to the inline sign-in it always had.
   */
  async function handleConfirm() {
    if (!branch || services.length === 0 || !date || !slot) return;

    // Name and phone are what turn an anonymous visitor into a bookable
    // customer; ask for them here rather than behind a login.
    if (!custName.trim() || !phone.trim()) {
      setNeedsDetails(true);
      setConfirmError("Enter your name and mobile number to confirm.");
      return;
    }

    setConfirmLoading(true);
    setConfirmError(null);
    try {
      const res = await fetch(API.public.appointments, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: branch.id,
          // Omitted entirely when the customer picked "any stylist".
          ...(worker ? { workerId: worker.id } : {}),
          serviceIds: services.map((s) => s.id),
          appointmentDate: date,
          startTime: slot,
          customerName: custName.trim(),
          customerPhone: phone.trim(),
          ...(custEmail.trim() ? { customerEmail: custEmail.trim() } : {}),
          notes: notes.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => null);

      if (res.status === 401) {
        // Only reachable when the branch explicitly requires an account.
        setNeedsAuth(true);
        setConfirmError(null);
        return;
      }
      if (!res.ok || !json?.success) {
        const fieldErrors = json?.errors
          ? Object.values(json.errors as Record<string, string[]>).flat().join(" · ")
          : "";
        throw new Error(fieldErrors || json?.message || "Booking failed");
      }

      // Success is shown in place. Navigating to /customer/bookings would bounce
      // a guest straight back to the login screen we just removed.
      setBooked(json.data as BookedAppointment);
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

  // Same panel, two mount points (inline under lg, sidebar at lg+). State lives
  // here, so both render identically — `idPrefix` keeps the ids unique.
  const guestDetails = (idPrefix: string, className?: string) => (
    <GuestDetailsPanel
      idPrefix={`guest-${idPrefix}`}
      name={custName}
      onName={setCustName}
      phone={phone}
      onPhone={setPhone}
      email={custEmail}
      onEmail={setCustEmail}
      showErrors={needsDetails}
      className={className}
    />
  );

  const bookingBar = (
    <BookingBar
      branch={branch}
      services={services}
      worker={worker}
      workerChosen={workerChosen}
      date={date}
      slot={slot}
      className={step === "service" ? "mb-3" : undefined}
      onChangeBranch={() => {
        setBranch(null);
        setServices([]);
        resetWorker();
        setDate("");
        setSlot("");
        setStep("branch");
      }}
      onChangeService={() => {
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
  );

  return (
    <div
      className={`bg-stone-950 text-stone-100 ${
        step === "service" ? "min-h-screen lg:h-dvh lg:overflow-hidden" : "min-h-screen"
      }`}
    >
      {/* The site header is `fixed` (site-header.tsx: pt-6 + an h-16 pill = 5.5rem
          tall), so it sits outside the document flow and every page must reserve
          that space itself or its first rows render underneath the glass. 8rem =
          5.5rem of clearance + the 2.5rem of breathing room this page always had. */}
      <div
        className={`mx-auto w-full max-w-7xl min-w-0 px-4 pt-28 sm:px-6 sm:pt-32 ${
          step === "service" ? "flex min-h-0 flex-col pb-6 lg:h-full lg:pb-4" : "pb-10"
        }`}
      >
        {step !== "service" && (
          <>
            <StepBar current={step} />
            {bookingBar}
          </>
        )}

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
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-6">
            <div className="flex min-h-0 min-w-0 flex-col">
              <div className="shrink-0 lg:hidden">
                <StepBar current={step} className="mb-4" />
              </div>
              <div className="shrink-0 pt-1 lg:pt-0">
                {bookingBar}
                <button
                  onClick={() => {
                    setBranch(null);
                    setServices([]);
                    resetWorker();
                    setDate("");
                    setSlot("");
                    setStep("branch");
                  }}
                  className="mb-3 flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-300"
                >
                  <ChevronLeft className="size-4" /> Change branch
                </button>
              </div>
              <ServiceStep
                branchId={branch.id}
                selected={services}
                onToggle={(s) => {
                  const next = services.some((p) => p.id === s.id)
                    ? services.filter((p) => p.id !== s.id)
                    : [...services, s];
                  setServices(next);
                  if (next.length === 0) {
                    resetWorker();
                    setDate("");
                    setSlot("");
                  }
                }}
                onContinue={() => {
                  if (services.length === 0) return;
                  setDate("");
                  setSlot("");
                  setStep("worker");
                }}
              />
            </div>
            <div className="hidden min-h-0 lg:block">
              <BookingProgressPanel
                current={step}
                branch={branch}
                services={services}
              />
            </div>
          </div>
        )}

        {step === "worker" && branch && services.length > 0 && (
          <>
            <button
              onClick={() => {
                setStep("service");
              }}
              className="mb-4 flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-300 transition"
            >
              <ChevronLeft className="size-4" /> Change services
            </button>
            <WorkerStep
              branchId={branch.id}
              serviceIds={services.map((s) => s.id)}
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

        {/* ── Success. Rendered in place: sending a guest to /customer/* would
            bounce them to the very login screen this flow removes. ── */}
        {booked && (
          <div className="mx-auto max-w-xl rounded-3xl border border-white/10 bg-stone-900 p-4 text-center sm:p-6">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <Check className="size-6" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-xl font-medium text-white">Appointment confirmed</h2>
            <p className="mt-1 text-sm text-white/60">
              Booking reference{" "}
              <span className="font-mono text-white">{booked.appointmentNo}</span>
            </p>

            <dl className="mt-6 space-y-2 text-left text-sm">
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-white/50">When</dt>
                <dd className="min-w-0 text-right text-white">
                  {new Date(booked.appointmentDate).toLocaleDateString("en-IN", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    timeZone: "UTC",
                  })}{" "}
                  · {booked.startTime}–{booked.endTime}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-white/50">Where</dt>
                <dd className="min-w-0 text-right break-words text-white">{booked.branch?.name ?? "—"}</dd>
              </div>
              {booked.worker && (
                <div className="flex justify-between gap-4">
                  <dt className="shrink-0 text-white/50">Stylist</dt>
                  <dd className="min-w-0 text-right break-words text-white">
                    {booked.worker.firstName} {booked.worker.lastName ?? ""}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 text-white/50">Services</dt>
                <dd className="min-w-0 text-right break-words text-white">
                  {booked.services.map((s) => s.name).join(", ")}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-white/10 pt-2">
                <dt className="shrink-0 text-white/50">Estimated total</dt>
                <dd className="shrink-0 font-medium text-white">
                  ₹{Number(booked.totalAmount).toLocaleString("en-IN")}
                </dd>
              </div>
            </dl>

            <p className="mt-5 text-xs text-white/40">
              We&apos;ve saved this against {booked.customer.phone}. Show the reference at the
              salon — no account needed.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link
                href="/"
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80 transition hover:bg-white/5"
              >
                Back to home
              </Link>
              <Link
                href="/login"
                className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-stone-900 transition hover:bg-white/90"
              >
                Create an account (optional)
              </Link>
            </div>
          </div>
        )}

        {!booked && step === "confirm" && branch && services.length > 0 && date && slot && (
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
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,420px)]">
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
                // Below lg the sidebar stacks underneath, which would put the
                // confirm button above the form it needs — so it renders inline.
                inlinePanel={!needsAuth ? guestDetails("m") : null}
              />
              {/* Guest details — the normal path. No account required. */}
              {!needsAuth && (
                <div className="hidden min-w-0 lg:block">
                  {guestDetails("d", "lg:sticky lg:top-24")}
                </div>
              )}
              {/* Only reachable when the branch explicitly requires an account. */}
              {/* order-first: this only appears after a confirm attempt was
                  rejected, so on a stacked mobile layout it belongs at the top
                  rather than below the button that triggered it. */}
              {needsAuth && (
                <div className="order-first min-w-0 rounded-3xl border border-white/10 bg-stone-900 p-4 sm:p-5 lg:order-none lg:sticky lg:top-24 lg:self-start">
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
