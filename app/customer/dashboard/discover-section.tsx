"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock, MapPin, Phone, Flame, ChevronRight } from "lucide-react";

export type DiscoverService = {
  id: string;
  name: string;
  image: string | null;
  description: string | null;
  basePrice: number;
  duration: number;
  gender: string;
  isPopular: boolean;
  category: { id: string; name: string };
};

export type DiscoverBranch = {
  id: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  phone: string;
  coverImage: string | null;
  description: string | null;
};

export function DiscoverSection({
  services,
  branches,
  customerGender,
}: {
  services: DiscoverService[];
  branches: DiscoverBranch[];
  customerGender: string | null;
}) {
  const categories = React.useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; name: string }[] = [];
    services.forEach((s) => {
      if (!seen.has(s.category.id)) {
        seen.add(s.category.id);
        out.push(s.category);
      }
    });
    return out;
  }, [services]);

  // Default gender filter to customer's gender if known
  const defaultGender =
    customerGender === "MALE" || customerGender === "FEMALE" ? customerGender : "ALL";

  const [gender, setGender] = React.useState<"ALL" | "MALE" | "FEMALE">(
    defaultGender as "ALL" | "MALE" | "FEMALE"
  );
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);

  const filtered = services.filter((s) => {
    const gMatch =
      gender === "ALL" || s.gender === gender || s.gender === "UNISEX";
    const cMatch = !categoryId || s.category.id === categoryId;
    return gMatch && cMatch;
  });

  const visible = showAll ? filtered : filtered.slice(0, 6);

  return (
    <div className="space-y-10">
      {/* ── Quick Book Banner — glassmorphism + animated bars ──────── */}
      <div className="book-card relative overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-white/12 via-white/[0.06] to-white/[0.02] p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8">
        <style>{`
          @keyframes bookSlide { from { opacity:0; transform: translateY(26px) scale(.985); } to { opacity:1; transform:none; } }
          @keyframes barGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
          .book-card { animation: bookSlide .7s cubic-bezier(.22,1,.36,1) both; }
          .book-bar { transform-origin: bottom; animation: barGrow .8s cubic-bezier(.34,1.3,.64,1) both; }
          @media (prefers-reduced-motion: reduce){ .book-card, .book-bar { animation: none !important; } }
        `}</style>

        {/* frosted highlights */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-16 size-52 rounded-full bg-cyan-400/10 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-16 left-10 size-44 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: copy + CTA */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Ready for a fresh look?</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">Book your next appointment</h2>
            <p className="mt-2 max-w-sm text-sm text-stone-300">Choose a branch, pick a service, select your slot — done in 60 seconds.</p>
            <Link
              href="/book"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-stone-950 shadow-lg shadow-black/30 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] hover:bg-stone-100"
            >
              Book Now <ChevronRight className="size-4" />
            </Link>
          </div>

          {/* Right: animated bar chart (glass sub-panel) */}
          <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-md">
            <div className="mb-3 flex items-center gap-4 text-[11px] text-stone-300">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-cyan-400" /> Available</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-violet-500" /> Booked</span>
            </div>
            <div className="flex items-end gap-2.5">
              {[{ g: 55, u: 38 }, { g: 34, u: 26 }, { g: 82, u: 46 }, { g: 60, u: 52 }, { g: 72, u: 28 }, { g: 66, u: 44 }].map((b, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-24 items-end gap-1">
                    <span className="book-bar w-2 rounded-t bg-gradient-to-t from-sky-600 to-cyan-300" style={{ height: `${b.g}%`, animationDelay: `${i * 90}ms` }} />
                    <span className="book-bar w-2 rounded-t bg-gradient-to-t from-violet-700 to-indigo-300" style={{ height: `${b.u}%`, animationDelay: `${i * 90 + 45}ms` }} />
                  </div>
                  <span className="text-[9px] text-stone-500">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Services Discovery ────────────────────────────────────── */}
      <div>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-stone-100">Explore Services</h2>
            <p className="text-xs text-stone-500">{filtered.length} services available</p>
          </div>
          <Link href="/services" className="text-xs text-[#C4C9D1] hover:underline">
            View all →
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-4 space-y-3">
          {/* Gender tabs */}
          <div className="flex gap-1.5">
            {(["ALL", "MALE", "FEMALE"] as const).map((g) => (
              <button
                key={g}
                onClick={() => { setGender(g); setShowAll(false); }}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  gender === g
                    ? "bg-[#C4C9D1] text-stone-950"
                    : "border border-white/10 text-stone-400 hover:border-white/20 hover:text-stone-200"
                }`}
              >
                {g === "ALL" ? "All" : g === "MALE" ? "Men" : "Women"}
              </button>
            ))}
          </div>

          {/* Category pills */}
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => { setCategoryId(null); setShowAll(false); }}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                  !categoryId
                    ? "bg-stone-700 text-stone-100"
                    : "border border-white/8 text-stone-500 hover:border-white/15 hover:text-stone-300"
                }`}
              >
                All categories
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCategoryId(c.id); setShowAll(false); }}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                    categoryId === c.id
                      ? "bg-stone-700 text-stone-100"
                      : "border border-white/8 text-stone-500 hover:border-white/15 hover:text-stone-300"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cards */}
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-stone-600">No services match your filters.</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((s) => (
                <Link
                  key={s.id}
                  href={`/book?serviceId=${s.id}`}
                  className="group overflow-hidden rounded-xl border border-white/8 bg-stone-900 transition hover:border-[#C4C9D1]/30"
                >
                  {/* Image */}
                  <div className="relative h-36 w-full overflow-hidden bg-stone-800">
                    {s.image ? (
                      <Image
                        src={s.image}
                        alt={s.name}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="text-4xl font-bold text-stone-700 opacity-50">{s.name[0]}</span>
                      </div>
                    )}
                    {s.isPopular && (
                      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-[#C4C9D1] px-2 py-0.5 text-[10px] font-bold text-stone-950">
                        <Flame className="size-2.5" /> Popular
                      </span>
                    )}
                    <span className="absolute right-2 top-2 rounded-full border border-white/10 bg-stone-900/80 px-2 py-0.5 text-[10px] font-medium text-stone-300 backdrop-blur-sm">
                      {s.category.name}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-3.5">
                    <h3 className="font-semibold text-stone-100 transition group-hover:text-[#C4C9D1]">{s.name}</h3>
                    {s.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-stone-500">{s.description}</p>
                    )}
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs text-stone-500">
                        <Clock className="size-3" /> {s.duration} min
                      </span>
                      <span className="font-semibold text-[#C4C9D1]">from ₹{s.basePrice.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="mt-2.5 rounded-full bg-[#C4C9D1]/10 py-1.5 text-center text-xs font-semibold text-[#C4C9D1] transition group-hover:bg-[#C4C9D1] group-hover:text-stone-950">
                      Book this service →
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {!showAll && filtered.length > 6 && (
              <button
                onClick={() => setShowAll(true)}
                className="mt-4 w-full rounded-xl border border-white/8 py-2.5 text-sm text-stone-400 transition hover:border-white/15 hover:text-stone-200"
              >
                Show {filtered.length - 6} more services
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Branches ──────────────────────────────────────────────── */}
      {branches.length > 0 && (
        <div>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-stone-100">Our Locations</h2>
              <p className="text-xs text-stone-500">{branches.length} {branches.length === 1 ? "branch" : "branches"} near you</p>
            </div>
            <Link href="/branches" className="text-xs text-[#C4C9D1] hover:underline">
              View all →
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => (
              <div
                key={b.id}
                className="overflow-hidden rounded-xl border border-white/8 bg-stone-900"
              >
                {/* Cover */}
                <div className="relative h-32 w-full overflow-hidden bg-stone-800">
                  {b.coverImage ? (
                    <Image
                      src={b.coverImage}
                      alt={b.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-4xl font-bold text-stone-700 opacity-30">{b.name[0]}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 to-transparent" />
                  <p className="absolute bottom-2 left-3 font-semibold text-stone-100">{b.name}</p>
                </div>

                {/* Details */}
                <div className="p-3.5 space-y-2">
                  {b.description && (
                    <p className="line-clamp-1 text-xs text-stone-500">{b.description}</p>
                  )}
                  <p className="flex items-start gap-1.5 text-xs text-stone-400">
                    <MapPin className="mt-0.5 size-3 shrink-0 text-[#C4C9D1]/60" />
                    {b.address}, {b.city}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-stone-400">
                    <Phone className="size-3 shrink-0 text-[#C4C9D1]/60" />
                    {b.phone}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Link
                      href={`/book?branchId=${b.id}`}
                      className="flex-1 rounded-full bg-[#C4C9D1] py-1.5 text-center text-xs font-bold text-stone-950 transition hover:bg-[#C4C9D1]"
                    >
                      Book Here
                    </Link>
                    <Link
                      href={`/branches/${b.slug}`}
                      className="flex-1 rounded-full border border-white/10 py-1.5 text-center text-xs text-stone-400 transition hover:border-white/20 hover:text-stone-200"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
