import prisma from "@/lib/db";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Phone } from "lucide-react";

export const metadata = {
  title: "Our Branches — Renzo",
  description: "Find a Renzo salon near you. Premium hair & beauty services across multiple locations.",
};

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; q?: string }>;
}) {
  const { city, q: search } = await searchParams;

  const branches = await prisma.branch.findMany({
    where: {
      isActive: true,
      isPublic: true,
      ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } },
              { address: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      city: true,
      state: true,
      address: true,
      phone: true,
      coverImage: true,
      description: true,
    },
  });

  const cities = await prisma.branch.findMany({
    where: { isActive: true, isPublic: true },
    select: { city: true },
    distinct: ["city"],
    orderBy: { city: "asc" },
  });

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Hero */}
      <div className="border-b border-white/5 bg-stone-900/60 py-14 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Our Salons</h1>
        <p className="mt-3 text-stone-400">
          {branches.length} {branches.length === 1 ? "location" : "locations"} — find one near you
        </p>

        {/* City filter */}
        {cities.length > 1 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/branches"
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                !city ? "bg-amber-500 text-stone-950" : "border border-white/10 text-stone-300 hover:border-white/20"
              }`}
            >
              All cities
            </Link>
            {cities.map((c) => (
              <Link
                key={c.city}
                href={`/branches?city=${encodeURIComponent(c.city)}`}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  city === c.city
                    ? "bg-amber-500 text-stone-950"
                    : "border border-white/10 text-stone-300 hover:border-white/20"
                }`}
              >
                {c.city}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {branches.length === 0 ? (
          <p className="py-20 text-center text-stone-500">No branches found.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => (
              <Link
                key={b.id}
                href={`/branches/${b.slug}`}
                className="group relative overflow-hidden rounded-2xl border border-white/8 bg-stone-900 transition hover:border-amber-500/30"
              >
                <div className="relative h-44 w-full overflow-hidden bg-stone-800">
                  {b.coverImage ? (
                    <Image
                      src={b.coverImage}
                      alt={b.name}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-stone-600">
                      <span className="text-4xl font-bold opacity-20">{b.name[0]}</span>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <h2 className="font-semibold text-stone-100 group-hover:text-amber-400 transition">{b.name}</h2>
                  {b.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-stone-500">{b.description}</p>
                  )}
                  <div className="mt-3 space-y-1.5">
                    <p className="flex items-start gap-1.5 text-xs text-stone-400">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-amber-500/70" />
                      {b.address}, {b.city}, {b.state}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-stone-400">
                      <Phone className="size-3.5 shrink-0 text-amber-500/70" />
                      {b.phone}
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Link
                      href={`/book?branchId=${b.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 rounded-full bg-amber-500 py-2 text-center text-xs font-bold text-stone-950 transition hover:bg-amber-400"
                    >
                      Book Now
                    </Link>
                    <span className="text-xs text-stone-600 hover:text-stone-400 transition">
                      View →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
