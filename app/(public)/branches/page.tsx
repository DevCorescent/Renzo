import prisma from "@/lib/db";
import Link from "next/link";
import { BranchCard } from "./branch-card";

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

  type CityRow = (typeof cities)[number];

  return (
    <div className="min-h-screen bg-stone-950">
      {/* Hero */}
      <div className="border-b border-[#C8A96A]/15 bg-stone-900/60 py-14 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-[#C8A96A] sm:text-4xl">Our Salons</h1>
        <p className="mt-3 text-[#F0E6C8]/70">
          {branches.length} {branches.length === 1 ? "location" : "locations"} — find one near you
        </p>

        {/* City filter */}
        {cities.length > 1 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/branches"
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                !city
                  ? "bg-[#C8A96A] text-stone-950"
                  : "border border-[#C8A96A]/30 text-[#F0E6C8]/80 hover:border-[#C8A96A]/70 hover:text-[#C8A96A]"
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
                    ? "bg-[#C8A96A] text-stone-950"
                    : "border border-[#C8A96A]/30 text-[#F0E6C8]/80 hover:border-[#C8A96A]/70 hover:text-[#C8A96A]"
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
          <p className="py-20 text-center text-[#C8A96A]/50">No branches found.</p>
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
