import prisma from "@/lib/db";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Calendar, User } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await prisma.blog.findFirst({
    where: { slug, isPublished: true },
    select: {
      title: true,
      excerpt: true,
      metaTitle: true,
      metaDescription: true,
    },
  });
  if (!post) return {};
  return {
    title: post.metaTitle || `${post.title} — Renzo`,
    description: post.metaDescription || post.excerpt || undefined,
  };
}

function formatDate(d: Date | null) {
  if (!d) return null;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const post = await prisma.blog.findFirst({
    where: { slug, isPublished: true },
    select: {
      title: true,
      excerpt: true,
      content: true,
      coverImage: true,
      category: true,
      tags: true,
      author: true,
      publishedAt: true,
    },
  });

  if (!post) notFound();

  const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(post.content);

  return (
    <article className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-stone-500 transition hover:text-stone-300"
        >
          <ChevronLeft className="size-4" /> All posts
        </Link>

        {post.category && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-400">
            {post.category}
          </p>
        )}
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{post.title}</h1>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-stone-500">
          {post.author && (
            <span className="inline-flex items-center gap-1.5">
              <User className="size-3.5" /> {post.author}
            </span>
          )}
          {post.publishedAt && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-3.5" /> {formatDate(post.publishedAt)}
            </span>
          )}
        </div>

        {post.coverImage && (
          <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-2xl border border-white/8 bg-stone-900">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
        )}

        {post.excerpt && (
          <p className="mt-8 text-lg leading-relaxed text-stone-400">{post.excerpt}</p>
        )}

        <div className="mt-8 border-t border-white/5 pt-8">
          {looksLikeHtml ? (
            <div
              className="prose prose-invert prose-stone max-w-none prose-headings:font-heading prose-a:text-amber-400"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          ) : (
            <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-stone-300">
              {post.content}
            </div>
          )}
        </div>

        {post.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2 border-t border-white/5 pt-6">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/10 px-3 py-1 text-xs text-stone-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
