// Standalone public Branches catalogue — kept intact for restoration.
// Primary booking entry is now the unified /book wizard (nav no longer
// links here). Direct /branches URLs and this page's implementation stay.
import prisma from "@/lib/db";
import Link from "next/link";
import { BranchCard } from "./branch-card";

export const dynamic = "force-dynamic";

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
  }).catch(() => []);

  const cities = await prisma.branch.findMany({
    where: { isActive: true, isPublic: true },
    select: { city: true },
    distinct: ["city"],
    orderBy: { city: "asc" },
  }).catch(() => []);

  type CityRow = (typeof cities)[number];

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Hero */}
      <div className="border-b border-white/10 bg-stone-900/60 py-14 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Our Salons</h1>
        <p className="mt-3 text-gray-400">
          {branches.length} {branches.length === 1 ? "location" : "locations"} — find one near you
        </p>

        {/* City filter */}
        {cities.length > 1 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/branches"
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                !city
                  ? "bg-white text-black"
                  : "border border-white/20 text-gray-300 hover:border-white/40 hover:text-white"
              }`}
            >
              All cities
            </Link>
            {cities.map((c: CityRow) => (
              <Link
                key={c.city}
                href={`/branches?city=${encodeURIComponent(c.city)}`}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  city === c.city
                    ? "bg-white text-black"
                    : "border border-white/20 text-gray-300 hover:border-white/40 hover:text-white"
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
          <p className="py-20 text-center text-gray-400">No branches found.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((b) => (
              <BranchCard key={b.id} b={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
