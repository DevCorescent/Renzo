import prisma from "@/lib/db";
import Image from "next/image";
import Link from "next/link";
import { Clock, Sparkles } from "lucide-react";

export const metadata = {
  title: "Packages & Combos — Renzo",
  description: "Save with Renzo packages and combos. Curated service bundles at better prices.",
};

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ gender?: string; popular?: string }>;
}) {
  const { gender, popular } = await searchParams;

  const packages = await prisma.package.findMany({
    where: {
      isActive: true,
      ...(gender && ["MALE", "FEMALE", "UNISEX"].includes(gender)
        ? { gender: gender as "MALE" | "FEMALE" | "UNISEX" }
        : {}),
      ...(popular === "1" ? { isPopular: true } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      image: true,
      price: true,
      originalPrice: true,
      validityDays: true,
      gender: true,
      isPopular: true,
      services: {
        where: { service: { isActive: true } },
        select: {
          quantity: true,
          service: {
            select: { id: true, name: true, duration: true },
          },
        },
      },
    },
  });

  const GENDERS = [
    { value: "", label: "All" },
    { value: "MALE", label: "Men" },
    { value: "FEMALE", label: "Women" },
    { value: "UNISEX", label: "Unisex" },
  ];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="border-b border-white/5 bg-stone-900/60 py-14 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Packages & Combos</h1>
        <p className="mt-3 text-stone-400">
          {packages.length} curated {packages.length === 1 ? "package" : "packages"} — more value, less fuss
        </p>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap gap-3">
          <div className="flex flex-wrap gap-1.5">
            {GENDERS.map((g) => (
              <Link
                key={g.value}
                href={
                  g.value
                    ? `/packages?gender=${g.value}${popular === "1" ? "&popular=1" : ""}`
                    : `/packages${popular === "1" ? "?popular=1" : ""}`
                }
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  (g.value === "" ? !gender : gender === g.value)
                    ? "bg-amber-500 text-stone-950"
                    : "border border-white/10 text-stone-400 hover:border-white/20"
                }`}
              >
                {g.label}
              </Link>
            ))}
          </div>
          <div className="ml-auto">
            <Link
              href={
                popular === "1"
                  ? `/packages${gender ? `?gender=${gender}` : ""}`
                  : `/packages?popular=1${gender ? `&gender=${gender}` : ""}`
              }
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                popular === "1"
                  ? "bg-stone-700 text-stone-100"
                  : "border border-white/10 text-stone-400 hover:border-white/20"
              }`}
            >
              <Sparkles className="size-3" /> Popular
            </Link>
          </div>
        </div>

        {packages.length === 0 ? (
          <p className="py-20 text-center text-stone-500">No packages available right now.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg) => {
              const totalMins = pkg.services.reduce(
                (sum, s) => sum + s.service.duration * s.quantity,
                0
              );
              const savings =
                pkg.originalPrice && pkg.originalPrice > pkg.price
                  ? pkg.originalPrice - pkg.price
                  : 0;

              return (
                <div
                  key={pkg.id}
                  className="group relative overflow-hidden rounded-2xl border border-white/8 bg-stone-900 transition hover:border-amber-500/30"
                >
                  <div className="relative h-40 w-full overflow-hidden bg-stone-800">
                    {pkg.image ? (
                      <Image
                        src={pkg.image}
                        alt={pkg.name}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-stone-700">
                        <span className="text-4xl font-bold opacity-30">{pkg.name[0]}</span>
                      </div>
                    )}
                    {pkg.isPopular && (
                      <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase text-stone-950">
                        Popular
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <h2 className="font-semibold text-stone-100">{pkg.name}</h2>
                    {pkg.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-stone-500">{pkg.description}</p>
                    )}

                    {pkg.services.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {pkg.services.slice(0, 4).map((s) => (
                          <li key={s.service.id} className="text-xs text-stone-400">
                            · {s.service.name}
                            {s.quantity > 1 ? ` ×${s.quantity}` : ""}
                          </li>
                        ))}
                        {pkg.services.length > 4 && (
                          <li className="text-xs text-stone-600">
                            +{pkg.services.length - 4} more
                          </li>
                        )}
                      </ul>
                    )}

                    <div className="mt-4 flex items-end justify-between gap-2">
                      <div>
                        <p className="font-semibold text-amber-400">
                          ₹{pkg.price.toLocaleString("en-IN")}
                        </p>
                        {savings > 0 && (
                          <p className="text-[11px] text-stone-500">
                            <span className="line-through">
                              ₹{pkg.originalPrice!.toLocaleString("en-IN")}
                            </span>{" "}
                            · save ₹{savings.toLocaleString("en-IN")}
                          </p>
                        )}
                      </div>
                      {totalMins > 0 && (
                        <span className="flex items-center gap-1 text-xs text-stone-500">
                          <Clock className="size-3" /> {totalMins} min
                        </span>
                      )}
                    </div>

                    <Link
                      href={`/book?packageId=${pkg.id}`}
                      className="mt-4 block w-full rounded-full bg-amber-500 py-2 text-center text-xs font-bold text-stone-950 transition hover:bg-amber-400"
                    >
                      Book this package →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
