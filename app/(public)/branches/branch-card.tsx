"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Phone } from "lucide-react";

export type BranchCardData = {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  address: string;
  phone: string;
  coverImage: string | null;
  description: string | null;
};

export function BranchCard({ b }: { b: BranchCardData }) {
  const router = useRouter();

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/branches/${b.slug}`)}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/branches/${b.slug}`); }}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-stone-900 transition hover:border-white/30 hover:shadow-[0_0_32px_-8px_rgba(255,255,255,0.07)]"
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
          <div className="flex h-full items-center justify-center">
            <span className="text-4xl font-bold text-white opacity-25">{b.name[0]}</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h2 className="font-semibold text-white transition group-hover:text-gray-100">{b.name}</h2>
        {b.description && (
          <p className="mt-1 line-clamp-2 text-xs text-gray-400">{b.description}</p>
        )}
        <div className="mt-3 space-y-1.5">
          <p className="flex items-start gap-1.5 text-xs text-gray-300">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-white" />
            {b.address}, {b.city}, {b.state}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-gray-300">
            <Phone className="size-3.5 shrink-0 text-white" />
            {b.phone}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/book?branchId=${b.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded-full bg-white py-2 text-center text-xs font-bold text-stone-950 transition hover:bg-gray-100"
          >
            Book Now
          </Link>
          <span className="text-xs text-gray-400 transition hover:text-white">
            View →
          </span>
        </div>
      </div>
    </div>
  );
}
