"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Clock, MapPin, Phone, Flame, Star, ChevronRight } from "lucide-react";

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
      {/* ── Quick Book Banner ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 p-6 shadow-lg">
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-900/70">Ready for a fresh look?</p>
          <h2 className="mt-1 text-2xl font-bold text-stone-950">Book your next appointment</h2>
          <p className="mt-1 text-sm text-amber-900/70">Choose a branch, pick a service, select your slot — done in 60 seconds.</p>
          <Link
            href="/book"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-2.5 text-sm font-bold text-amber-400 transition hover:bg-stone-800"
          >
            Book Now <ChevronRight className="size-4" />
          </Link>
        </div>
        {/* decorative circles */}
        <div className="absolute -right-8 -top-8 size-40 rounded-full bg-amber-300/30" />
        <div className="absolute -bottom-6 right-16 size-24 rounded-full bg-amber-600/20" />
      </div>

      {/* ── Services Discovery ────────────────────────────────────── */}
      <div>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-stone-100">Explore Services</h2>
            <p className="text-xs text-stone-500">{filtered.length} services available</p>
          </div>
          <Link href="/services" className="text-xs text-amber-400 hover:underline">
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
                    ? "bg-amber-500 text-stone-950"
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
                  className="group overflow-hidden rounded-xl border border-white/8 bg-stone-900 transition hover:border-amber-500/30"
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
                      <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-stone-950">
                        <Flame className="size-2.5" /> Popular
                      </span>
                    )}
                    <span className="absolute right-2 top-2 rounded-full border border-white/10 bg-stone-900/80 px-2 py-0.5 text-[10px] font-medium text-stone-300 backdrop-blur-sm">
                      {s.category.name}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-3.5">
                    <h3 className="font-semibold text-stone-100 transition group-hover:text-amber-400">{s.name}</h3>
                    {s.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-stone-500">{s.description}</p>
                    )}
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-xs text-stone-500">
                        <Clock className="size-3" /> {s.duration} min
                      </span>
                      <span className="font-semibold text-amber-400">from ₹{s.basePrice.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="mt-2.5 rounded-full bg-amber-500/10 py-1.5 text-center text-xs font-semibold text-amber-400 transition group-hover:bg-amber-500 group-hover:text-stone-950">
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
            <Link href="/branches" className="text-xs text-amber-400 hover:underline">
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
                    <MapPin className="mt-0.5 size-3 shrink-0 text-amber-500/60" />
                    {b.address}, {b.city}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-stone-400">
                    <Phone className="size-3 shrink-0 text-amber-500/60" />
                    {b.phone}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Link
                      href={`/book?branchId=${b.id}`}
                      className="flex-1 rounded-full bg-amber-500 py-1.5 text-center text-xs font-bold text-stone-950 transition hover:bg-amber-400"
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
