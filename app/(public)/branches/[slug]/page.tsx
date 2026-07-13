import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Phone, Clock, ChevronRight } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const branch = await prisma.branch.findFirst({ where: { slug, isActive: true, isPublic: true }, select: { name: true, description: true } });
  if (!branch) return {};
  return { title: `${branch.name} — Renzo`, description: branch.description ?? undefined };
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function BranchDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const branch = await prisma.branch.findFirst({
    where: { slug, isActive: true, isPublic: true },
    include: {
      timings: { orderBy: { dayOfWeek: "asc" } },
      servicePricings: {
        where: { isActive: true },
        include: {
          service: {
            select: { id: true, name: true, slug: true, image: true, duration: true, gender: true, category: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!branch) return notFound();

  // Group service pricings by category
  type ServicePricing = (typeof branch.servicePricings)[number];
  const catMap = new Map<string, { catName: string; items: ServicePricing[] }>();
  for (const sp of branch.servicePricings) {
    const cat = sp.service.category.name;
    if (!catMap.has(cat)) catMap.set(cat, { catName: cat, items: [] });
    catMap.get(cat)!.items.push(sp);
  }
  const servicesByCategory = Array.from(catMap.values());

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Hero */}
      <div className="relative h-64 w-full overflow-hidden bg-stone-900 sm:h-80">
        {branch.coverImage ? (
          <Image
            src={branch.coverImage}
            alt={branch.name}
            fill
            priority
            className="object-cover opacity-70"
            sizes="100vw"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/30 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 sm:p-8">
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-amber-400">Renzo Salon</p>
          <h1 className="text-3xl font-bold sm:text-4xl">{branch.name}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-400">
            <MapPin className="size-3.5 text-amber-500/70" />
            {branch.address}, {branch.city}, {branch.state}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left: Services */}
          <div className="lg:col-span-2">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Services at this branch</h2>
              <Link
                href={`/book?branchId=${branch.id}`}
                className="rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-400 transition"
              >
                Book now
              </Link>
            </div>

            {branch.servicePricings.length === 0 ? (
              <p className="text-stone-500">No services listed yet.</p>
            ) : (
              <div className="space-y-6">
                {servicesByCategory.map(({ catName, items }) => (
                  <div key={catName}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-500">{catName}</p>
                    <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/8 bg-stone-900">
                      {items.map((sp) => (
                        <Link
                          key={sp.id}
                          href={`/book?branchId=${branch.id}&serviceId=${sp.service.id}`}
                          className="group flex items-center gap-3 p-4 hover:bg-white/3 transition"
                        >
                          {sp.service.image ? (
                            <Image
                              src={sp.service.image}
                              alt={sp.service.name}
                              width={48}
                              height={48}
                              className="rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-stone-800 text-stone-600">
                              <span className="text-lg font-bold">{sp.service.name[0]}</span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-stone-100 group-hover:text-amber-400 transition">{sp.service.name}</p>
                            <p className="text-xs text-stone-500">{sp.service.duration} min · {sp.service.gender.toLowerCase()}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-amber-400">₹{sp.price.toLocaleString("en-IN")}</p>
                            <ChevronRight className="ml-auto mt-0.5 size-4 text-stone-600 group-hover:text-amber-400 transition" />
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Info */}
          <div className="space-y-5">
            {/* Contact */}
            <div className="rounded-xl border border-white/8 bg-stone-900 p-5">
              <h3 className="mb-3 text-sm font-semibold text-stone-300">Contact</h3>
              <div className="space-y-2 text-sm text-stone-400">
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-amber-500/70" />
                  {branch.address}, {branch.city}, {branch.state} {branch.pincode}
                </p>
                <p className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0 text-amber-500/70" />
                  {branch.phone}
                </p>
              </div>
              {branch.mapUrl && (
                <Link
                  href={branch.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-xs text-amber-400 hover:underline"
                >
                  View on map →
                </Link>
              )}
            </div>

            {/* Timings */}
            {branch.timings.length > 0 && (
              <div className="rounded-xl border border-white/8 bg-stone-900 p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-300">
                  <Clock className="size-4 text-amber-500/70" /> Hours
                </h3>
                <div className="space-y-1.5">
                  {branch.timings.map((t) => (
                    <div key={t.id} className="flex justify-between text-xs">
                      <span className="text-stone-400">{DAYS[t.dayOfWeek]}</span>
                      {t.isOpen ? (
                        <span className="text-stone-300">{t.openTime} – {t.closeTime}</span>
                      ) : (
                        <span className="text-red-400/70">Closed</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Book CTA */}
            <Link
              href={`/book?branchId=${branch.id}`}
              className="block rounded-xl bg-amber-500 p-4 text-center font-semibold text-stone-950 hover:bg-amber-400 transition"
            >
              Book an Appointment
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
