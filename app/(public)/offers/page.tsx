import prisma from "@/lib/db";
import Image from "next/image";
import Link from "next/link";
import { Tag, Calendar } from "lucide-react";

export const metadata = {
  title: "Offers & Deals — Renzo",
  description: "Current Renzo salon offers and seasonal deals. Book and save.",
};

const OFFER_LABELS: Record<string, string> = {
  SEASONAL: "Seasonal",
  FIRST_BOOKING: "First booking",
  MEMBERSHIP: "Membership",
  FLASH: "Flash deal",
  REFERRAL: "Referral",
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function discountLabel(o: {
  discountPercent: number | null;
  discountAmount: number | null;
}) {
  if (o.discountPercent != null && o.discountPercent > 0) {
    return `${o.discountPercent}% off`;
  }
  if (o.discountAmount != null && o.discountAmount > 0) {
    return `₹${o.discountAmount.toLocaleString("en-IN")} off`;
  }
  return null;
}

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const { branchId } = await searchParams;
  const now = new Date();

  const [offers, branches] = await Promise.all([
    prisma.offer.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
        ...(branchId
          ? { AND: [{ OR: [{ branchId }, { branchId: null }] }] }
          : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { validFrom: "desc" }],
      select: {
        id: true,
        title: true,
        description: true,
        image: true,
        type: true,
        discountPercent: true,
        discountAmount: true,
        validFrom: true,
        validUntil: true,
        branchId: true,
        branch: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.branch.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="border-b border-white/5 bg-stone-900/60 py-14 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Offers & Deals</h1>
        <p className="mt-3 text-stone-400">
          {offers.length} active {offers.length === 1 ? "offer" : "offers"} right now
        </p>

        {branches.length > 1 && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link
              href="/offers"
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                !branchId
                  ? "bg-amber-500 text-stone-950"
                  : "border border-white/10 text-stone-300 hover:border-white/20"
              }`}
            >
              All branches
            </Link>
            {branches.map((b) => (
              <Link
                key={b.id}
                href={`/offers?branchId=${b.id}`}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  branchId === b.id
                    ? "bg-amber-500 text-stone-950"
                    : "border border-white/10 text-stone-300 hover:border-white/20"
                }`}
              >
                {b.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {offers.length === 0 ? (
          <p className="py-20 text-center text-stone-500">No offers available at the moment.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {offers.map((o) => {
              const disc = discountLabel(o);
              return (
                <article
                  key={o.id}
                  className="group relative overflow-hidden rounded-2xl border border-white/8 bg-stone-900 transition hover:border-amber-500/30"
                >
                  <div className="relative h-40 w-full overflow-hidden bg-stone-800">
                    {o.image ? (
                      <Image
                        src={o.image}
                        alt={o.title}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-amber-500/20 to-stone-800">
                        <Tag className="size-10 text-amber-500/50" />
                      </div>
                    )}
                    {disc && (
                      <span className="absolute left-2 top-2 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold uppercase text-stone-950">
                        {disc}
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-500/80">
                      {OFFER_LABELS[o.type] ?? o.type}
                    </span>
                    <h2 className="mt-1 font-semibold text-stone-100">{o.title}</h2>
                    {o.description && (
                      <p className="mt-1 line-clamp-3 text-xs text-stone-500">{o.description}</p>
                    )}

                    <div className="mt-3 space-y-1 text-xs text-stone-400">
                      <p className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 shrink-0 text-amber-500/70" />
                        From {formatDate(o.validFrom)}
                        {o.validUntil ? ` · until ${formatDate(o.validUntil)}` : ""}
                      </p>
                      <p className="text-stone-500">
                        {o.branch ? o.branch.name : "All branches"}
                      </p>
                    </div>

                    <Link
                      href={o.branchId ? `/book?branchId=${o.branchId}` : "/book"}
                      className="mt-4 block w-full rounded-full bg-amber-500 py-2 text-center text-xs font-bold text-stone-950 transition hover:bg-amber-400"
                    >
                      Book & save →
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
