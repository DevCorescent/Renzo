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
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-[#C8A96A]/20 bg-stone-900 transition hover:border-[#C8A96A]/60 hover:shadow-[0_0_32px_-8px_rgba(200,169,106,0.22)]"
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
            <span className="text-4xl font-bold text-[#C8A96A] opacity-25">{b.name[0]}</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h2 className="font-semibold text-[#C8A96A] transition group-hover:text-[#E8CC88]">{b.name}</h2>
        {b.description && (
          <p className="mt-1 line-clamp-2 text-xs text-[#F0E6C8]/60">{b.description}</p>
        )}
        <div className="mt-3 space-y-1.5">
          <p className="flex items-start gap-1.5 text-xs text-[#F0E6C8]/75">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#C8A96A]" />
            {b.address}, {b.city}, {b.state}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-[#F0E6C8]/75">
            <Phone className="size-3.5 shrink-0 text-[#C8A96A]" />
            {b.phone}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/book?branchId=${b.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded-full bg-[#C8A96A] py-2 text-center text-xs font-bold text-stone-950 transition hover:bg-[#E8CC88]"
          >
            Book Now
          </Link>
          <span className="text-xs text-[#C8A96A]/60 transition hover:text-[#C8A96A]">
            View →
          </span>
        </div>
      </div>
    </div>
  );
}
