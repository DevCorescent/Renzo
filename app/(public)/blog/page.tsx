import prisma from "@/lib/db";
import Image from "next/image";
import Link from "next/link";
import { Calendar } from "lucide-react";

export const metadata = {
  title: "Journal — Renzo",
  description: "Tips, trends and rituals from Renzo stylists.",
};

function formatDate(d: Date | null) {
  if (!d) return null;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function BlogPage() {
  const posts = await prisma.blog.findMany({
    where: { isPublished: true },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      category: true,
      tags: true,
      author: true,
      publishedAt: true,
    },
  });

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="border-b border-white/5 bg-stone-900/60 py-14 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Journal</h1>
        <p className="mt-3 text-stone-400">Stories, tips and trends from the Renzo studio</p>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {posts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-stone-900/40 px-6 py-20 text-center">
            <p className="text-lg font-medium text-stone-300">No posts yet</p>
            <p className="mt-2 text-sm text-stone-500">
              Our journal is coming soon — check back for styling tips and studio stories.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/8 bg-stone-900 transition hover:border-amber-500/30"
              >
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-stone-800">
                  {post.coverImage ? (
                    <Image
                      src={post.coverImage}
                      alt={post.title}
                      fill
                      className="object-cover transition duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-stone-700">
                      <span className="text-4xl font-bold opacity-30">{post.title[0]}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    {post.category && (
                      <span className="font-semibold uppercase tracking-widest text-amber-500/80">
                        {post.category}
                      </span>
                    )}
                    {post.publishedAt && (
                      <>
                        {post.category && <span className="text-stone-700">·</span>}
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="size-3" />
                          {formatDate(post.publishedAt)}
                        </span>
                      </>
                    )}
                  </div>
                  <h2 className="mt-2 font-semibold text-stone-100 transition group-hover:text-amber-400">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="mt-1 line-clamp-2 flex-1 text-xs text-stone-500">{post.excerpt}</p>
                  )}
                  <span className="mt-4 text-xs font-medium text-stone-400 group-hover:text-amber-400 transition">
                    Read article →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
