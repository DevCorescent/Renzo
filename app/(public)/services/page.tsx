import prisma from "@/lib/db";
import Image from "next/image";
import Link from "next/link";
import { Clock } from "lucide-react";

export const metadata = {
  title: "Services — Renzo",
  description: "Explore our full range of hair & beauty services. Book online in minutes.",
};

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string; gender?: string; q?: string }>;
}) {
  const { categoryId, gender, q: search } = await searchParams;

  const [categories, services] = await Promise.all([
    prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.service.findMany({
      where: {
        isActive: true,
        category: { isActive: true },
        ...(categoryId ? { categoryId } : {}),
        ...(gender && ["MALE", "FEMALE", "UNISEX"].includes(gender) ? { gender: gender as "MALE" | "FEMALE" | "UNISEX" } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        basePrice: true,
        duration: true,
        gender: true,
        isPopular: true,
        category: { select: { id: true, name: true } },
      },
    }),
  ]);

  // Group services by category
  type CategoryRow = (typeof categories)[number];
  type ServiceItem = (typeof services)[number];
  const catMap2 = new Map<string, { catName: string; catId: string; items: ServiceItem[] }>();
  for (const s of services) {
    if (!catMap2.has(s.category.id)) catMap2.set(s.category.id, { catName: s.category.name, catId: s.category.id, items: [] });
    catMap2.get(s.category.id)!.items.push(s);
  }
  const byCategory = Array.from(catMap2.values());

  const GENDERS = [
    { value: "", label: "All" },
    { value: "MALE", label: "Men" },
    { value: "FEMALE", label: "Women" },
    { value: "UNISEX", label: "Unisex" },
  ];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Header */}
      <div className="border-b border-white/5 bg-stone-900/60 py-14 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Our Services</h1>
        <p className="mt-3 text-stone-400">{services.length} services across {categories.length} categories</p>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* Filters */}
        <div className="mb-8 flex flex-wrap gap-3">
          {/* Category filter */}
          <div className="flex flex-wrap gap-1.5">
            <Link
              href="/services"
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                !categoryId && !gender && !search
                  ? "bg-amber-500 text-stone-950"
                  : "border border-white/10 text-stone-400 hover:border-white/20"
              }`}
            >
              All
            </Link>
            {categories.map((c: CategoryRow) => (
              <Link
                key={c.id}
                href={`/services?categoryId=${c.id}${gender ? `&gender=${gender}` : ""}`}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  categoryId === c.id
                    ? "bg-amber-500 text-stone-950"
                    : "border border-white/10 text-stone-400 hover:border-white/20"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>

          {/* Gender filter */}
          <div className="ml-auto flex gap-1">
            {GENDERS.map((g) => (
              <Link
                key={g.value}
                href={g.value ? `/services?${categoryId ? `categoryId=${categoryId}&` : ""}gender=${g.value}` : `/services${categoryId ? `?categoryId=${categoryId}` : ""}`}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                  (g.value === "" ? !gender : gender === g.value)
                    ? "bg-stone-700 text-stone-100"
                    : "border border-white/10 text-stone-400 hover:border-white/20"
                }`}
              >
                {g.label}
              </Link>
            ))}
          </div>
        </div>

        {services.length === 0 ? (
          <p className="py-20 text-center text-stone-500">No services found.</p>
        ) : (
          <div className="space-y-10">
            {byCategory.map(({ catName, catId, items }) => (
              <div key={catId}>
                <h2 className="mb-4 text-lg font-semibold text-stone-200">{catName}</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((s) => (
                    <Link
                      key={s.id}
                      href={`/book?serviceId=${s.id}`}
                      className="group relative overflow-hidden rounded-2xl border border-white/8 bg-stone-900 transition hover:border-amber-500/30"
                    >
                      <div className="relative h-40 w-full overflow-hidden bg-stone-800">
                        {s.image ? (
                          <Image
                            src={s.image}
                            alt={s.name}
                            fill
                            className="object-cover transition duration-500 group-hover:scale-105"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-stone-700">
                            <span className="text-4xl font-bold opacity-30">{s.name[0]}</span>
                          </div>
                        )}
                        {s.isPopular && (
                          <span className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase text-stone-950">
                            Popular
                          </span>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-stone-100 group-hover:text-amber-400 transition">{s.name}</h3>
                        {s.description && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{s.description}</p>
                        )}
                        <div className="mt-3 flex items-center justify-between">
                          <span className="flex items-center gap-1 text-xs text-stone-500">
                            <Clock className="size-3" /> {s.duration} min
                          </span>
                          <span className="font-semibold text-amber-400">from ₹{s.basePrice.toLocaleString("en-IN")}</span>
                        </div>
                        <div className="mt-3">
                          <span className="block w-full rounded-full bg-amber-500 py-2 text-center text-xs font-bold text-stone-950 transition group-hover:bg-amber-400">
                            Book this service →
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
