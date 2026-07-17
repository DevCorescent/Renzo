import prisma from "@/lib/db";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, ChevronLeft, Plus } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = await prisma.service.findFirst({
    where: { slug, isActive: true, category: { isActive: true } },
    select: { name: true, description: true },
  });
  if (!service) return {};
  return {
    title: `${service.name} — Renzo`,
    description: service.description ?? undefined,
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const service = await prisma.service.findFirst({
    where: {
      slug,
      isActive: true,
      category: { isActive: true },
    },
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
      category: { select: { id: true, name: true, slug: true } },
      subCategory: { select: { name: true } },
      variants: {
        where: { isActive: true },
        orderBy: { price: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          duration: true,
        },
      },
      serviceAddOns: {
        where: { addOn: { isActive: true } },
        include: {
          addOn: {
            select: {
              id: true,
              name: true,
              description: true,
              price: true,
              duration: true,
            },
          },
        },
      },
    },
  });

  if (!service) notFound();

  const genderLabel =
    service.gender === "MALE" ? "Men" : service.gender === "FEMALE" ? "Women" : "Unisex";

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="relative h-56 w-full overflow-hidden bg-stone-900 sm:h-72">
        {service.image ? (
          <Image
            src={service.image}
            alt={service.name}
            fill
            priority
            className="object-cover opacity-70"
            sizes="100vw"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/40 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6 sm:p-8">
          <Link
            href="/services"
            className="mb-3 inline-flex items-center gap-1 text-xs text-stone-400 transition hover:text-stone-200"
          >
            <ChevronLeft className="size-3.5" /> All services
          </Link>
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-amber-400">
            {service.category.name}
            {service.subCategory ? ` · ${service.subCategory.name}` : ""}
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">{service.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-stone-400">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-amber-500/70" />
              {service.duration} min
            </span>
            <span>{genderLabel}</span>
            {service.isPopular && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase text-stone-950">
                Popular
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            {service.description && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">About this service</h2>
                <p className="leading-relaxed text-stone-400">{service.description}</p>
              </section>
            )}

            {service.variants.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">Options</h2>
                <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/8 bg-stone-900">
                  {service.variants.map((v) => (
                    <div key={v.id} className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <p className="font-medium text-stone-100">{v.name}</p>
                        {v.description && (
                          <p className="mt-0.5 text-xs text-stone-500">{v.description}</p>
                        )}
                        <p className="mt-1 flex items-center gap-1 text-xs text-stone-500">
                          <Clock className="size-3" /> {v.duration} min
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold text-amber-400">
                        ₹{v.price.toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {service.serviceAddOns.length > 0 && (
              <section>
                <h2 className="mb-3 text-lg font-semibold">Add-ons</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {service.serviceAddOns.map(({ addOn }) => (
                    <div
                      key={addOn.id}
                      className="flex items-start gap-3 rounded-xl border border-white/8 bg-stone-900 p-4"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-stone-800 text-amber-500/70">
                        <Plus className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-stone-100">{addOn.name}</p>
                          <span className="shrink-0 text-sm font-semibold text-amber-400">
                            +₹{addOn.price.toLocaleString("en-IN")}
                          </span>
                        </div>
                        {addOn.description && (
                          <p className="mt-0.5 text-xs text-stone-500">{addOn.description}</p>
                        )}
                        {addOn.duration > 0 && (
                          <p className="mt-1 text-xs text-stone-600">+{addOn.duration} min</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-white/8 bg-stone-900 p-5">
              <p className="text-xs uppercase tracking-widest text-stone-500">Starting from</p>
              <p className="mt-1 text-3xl font-bold text-amber-400">
                ₹{service.basePrice.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-stone-400">
                <Clock className="size-3.5" /> {service.duration} minutes
              </p>
              <Link
                href={`/book?serviceId=${service.id}`}
                className="mt-5 block w-full rounded-full bg-amber-500 py-3 text-center text-sm font-bold text-stone-950 transition hover:bg-amber-400"
              >
                Book this service
              </Link>
              <Link
                href="/services"
                className="mt-3 block text-center text-xs text-stone-500 transition hover:text-stone-300"
              >
                Browse all services
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
