import prisma from "@/lib/db";
import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";

export const metadata = {
  title: "Our Stylists — Renzo",
  description: "Meet Renzo's expert stylists. Browse profiles, ratings, and book your favourite artist.",
};

function workerName(w: { displayName: string | null; firstName: string; lastName: string }) {
  return w.displayName?.trim() || `${w.firstName} ${w.lastName}`.trim();
}

export default async function StylistsPage() {
  const workers = await prisma.workerProfile.findMany({
    where: { isPublic: true, isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      bio: true,
      profilePhoto: true,
      experience: true,
      designation: { select: { name: true } },
      ratingSummary: { select: { averageRating: true, totalReviews: true } },
    },
  });

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="border-b border-white/5 bg-stone-900/60 py-14 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Our Stylists</h1>
        <p className="mt-3 text-stone-400">
          {workers.length} {workers.length === 1 ? "artist" : "artists"} ready to craft your look
        </p>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {workers.length === 0 ? (
          <p className="py-20 text-center text-stone-500">No stylists available yet.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {workers.map((w) => {
              const name = workerName(w);
              const rating = w.ratingSummary?.averageRating ?? 0;
              const reviews = w.ratingSummary?.totalReviews ?? 0;

              return (
                <Link
                  key={w.id}
                  href={`/stylists/${w.id}`}
                  className="group relative overflow-hidden rounded-2xl border border-white/8 bg-stone-900 transition hover:border-amber-500/30"
                >
                  <div className="relative h-56 w-full overflow-hidden bg-stone-800">
                    {w.profilePhoto ? (
                      <Image
                        src={w.profilePhoto}
                        alt={name}
                        fill
                        className="object-cover transition duration-500 group-hover:scale-105"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-stone-600">
                        <span className="text-5xl font-bold opacity-30">{w.firstName[0]}</span>
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <h2 className="font-semibold text-stone-100 transition group-hover:text-amber-400">
                      {name}
                    </h2>
                    {w.designation?.name && (
                      <p className="mt-0.5 text-xs text-stone-500">{w.designation.name}</p>
                    )}
                    {w.bio && (
                      <p className="mt-2 line-clamp-2 text-xs text-stone-500">{w.bio}</p>
                    )}

                    <div className="mt-3 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-sm text-stone-300">
                        <Star
                          className={`size-3.5 ${rating > 0 ? "fill-amber-400 text-amber-400" : "text-stone-600"}`}
                        />
                        {rating > 0 ? rating.toFixed(1) : "—"}
                        {reviews > 0 && (
                          <span className="text-xs text-stone-500">
                            ({reviews})
                          </span>
                        )}
                      </span>
                      {w.experience > 0 && (
                        <span className="text-xs text-stone-500">
                          {w.experience} yr{w.experience === 1 ? "" : "s"} exp
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <span className="block w-full rounded-full bg-amber-500 py-2 text-center text-xs font-bold text-stone-950 transition group-hover:bg-amber-400">
                        View profile →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
