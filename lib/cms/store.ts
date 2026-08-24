// ============================================================================
// OWNER  : Gauransh
// MODULE : Homepage CMS — persistence
//
// WHY NO NEW TABLE
// The schema is frozen. This module therefore stores every CMS document in the
// EXISTING `Page` model (prisma/schema.prisma → model Page), which is currently
// unused by any feature — nothing reads it, nothing writes it, nothing lists it.
// Each document is one row addressed by its unique `slug`:
//
//   system/homepage-draft   the working draft            (isPublished = false)
//   system/homepage-live    the content the public sees  (isPublished = true)
//   system/homepage-v<n>    an immutable publish snapshot
//   system/homepage-media   the media library index
//
// The `content` column holds the JSON document. Reads are re-validated through
// the zod schema on every load, so a truncated, hand-edited or older row degrades
// to the built-in defaults instead of crashing a render.
//
// PUBLISHING RULE
// saveDraft() NEVER touches the live row. The public homepage changes only when
// publishDraft() runs, which is the single place `system/homepage-live` is
// written — and it snapshots the outgoing content as a version first.
// ============================================================================

import { cache } from "react";
import prisma from "@/lib/db";
import type { AuthUser } from "@/types/api";
import {
  HomeContentSchema,
  DraftEnvelopeSchema,
  PublishedEnvelopeSchema,
  MediaLibrarySchema,
  type HomeContent,
  type DraftEnvelope,
  type PublishedEnvelope,
  type MediaItem,
  type MediaLibrary,
} from "./schema";
import { DEFAULT_HOME_CONTENT, cloneDefaultContent, normalizeCompanyAddress } from "./defaults";

const SLUG_DRAFT = "system/homepage-draft";
const SLUG_LIVE = "system/homepage-live";
const SLUG_MEDIA = "system/homepage-media";
const VERSION_PREFIX = "system/homepage-v";

const versionSlug = (version: number) => `${VERSION_PREFIX}${version}`;

/** Every version row must keep at most this many snapshots queried at once. */
const VERSION_PAGE_SIZE = 50;

/* ─── Low-level row access ─────────────────────────────────────────────────── */

async function readRow(slug: string): Promise<string | null> {
  const row = await prisma.page.findUnique({ where: { slug }, select: { content: true } });
  return row?.content ?? null;
}

async function writeRow(slug: string, title: string, content: string, isPublished: boolean) {
  await prisma.page.upsert({
    where: { slug },
    update: { content, title, isPublished },
    create: { slug, title, content, isPublished },
  });
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/* ─── Draft ────────────────────────────────────────────────────────────────── */

/**
 * The working draft. If no draft row exists yet it is SEEDED IN MEMORY from the
 * live content (or the built-in defaults) and NOT written — opening the editor is
 * a pure read, so merely looking at the CMS never creates state.
 */
export async function getDraft(): Promise<DraftEnvelope> {
  const parsed = DraftEnvelopeSchema.safeParse(parseJson(await readRow(SLUG_DRAFT)));
  if (parsed.success) {
    return { ...parsed.data, content: normalizeCompanyAddress(parsed.data.content) };
  }

  const live = await getLive();
  return {
    content: live ? normalizeCompanyAddress(live.content) : cloneDefaultContent(),
    updatedAt: new Date().toISOString(),
    updatedBy: "",
  };
}

export async function saveDraft(content: HomeContent, actorName: string): Promise<DraftEnvelope> {
  const envelope: DraftEnvelope = {
    content: normalizeCompanyAddress(content),
    updatedAt: new Date().toISOString(),
    updatedBy: actorName,
  };
  await writeRow(SLUG_DRAFT, "Homepage — draft", JSON.stringify(envelope), false);
  return envelope;
}

/** Throw the draft away and start again from what is currently live. */
export async function discardDraft(actorName: string): Promise<DraftEnvelope> {
  const live = await getLive();
  return saveDraft(live ? live.content : cloneDefaultContent(), actorName);
}

/* ─── Live ─────────────────────────────────────────────────────────────────── */

/** The published document, or null when nothing has ever been published. */
export async function getLive(): Promise<PublishedEnvelope | null> {
  const parsed = PublishedEnvelopeSchema.safeParse(parseJson(await readRow(SLUG_LIVE)));
  return parsed.success ? parsed.data : null;
}

/**
 * What the PUBLIC site renders.
 *
 * This is the one function on the visitor's critical path, so it can never throw
 * and can never return something unrenderable: any database error, missing row or
 * failed validation resolves to the built-in defaults — which are a transcription
 * of the pre-CMS homepage. A dead database therefore degrades to exactly the page
 * that shipped before this feature existed.
 *
 * Wrapped in React's `cache` because a single homepage request asks for this
 * three times over — once for the favicon in generateMetadata, once for the
 * layout's header/footer, once for the page's sections. Per-request memoisation
 * turns that back into one query.
 */
export const getPublishedHomeContent = cache(async (): Promise<HomeContent> => {
  try {
    const live = await getLive();
    return normalizeCompanyAddress(live?.content ?? DEFAULT_HOME_CONTENT);
  } catch {
    return DEFAULT_HOME_CONTENT;
  }
});

/* ─── Versions ─────────────────────────────────────────────────────────────── */

export type VersionSummary = {
  version: number;
  publishedAt: string;
  publishedBy: string;
  summary: string;
  isCurrent: boolean;
};

export async function listVersions(): Promise<VersionSummary[]> {
  const [rows, live] = await Promise.all([
    prisma.page.findMany({
      where: { slug: { startsWith: VERSION_PREFIX } },
      select: { content: true },
      orderBy: { createdAt: "desc" },
      take: VERSION_PAGE_SIZE,
    }),
    getLive(),
  ]);

  return rows
    .map((row) => PublishedEnvelopeSchema.safeParse(parseJson(row.content)))
    .flatMap((parsed) =>
      parsed.success
        ? [
            {
              version: parsed.data.version,
              publishedAt: parsed.data.publishedAt,
              publishedBy: parsed.data.publishedBy,
              summary: parsed.data.summary,
              isCurrent: parsed.data.version === live?.version,
            },
          ]
        : []
    )
    .sort((a, b) => b.version - a.version);
}

export async function getVersion(version: number): Promise<PublishedEnvelope | null> {
  const parsed = PublishedEnvelopeSchema.safeParse(parseJson(await readRow(versionSlug(version))));
  return parsed.success ? parsed.data : null;
}

/* ─── Publish ──────────────────────────────────────────────────────────────── */

/**
 * Promote the current draft to live.
 *
 * Order matters: the snapshot row is written BEFORE the live row, so a failure
 * halfway through leaves the old content live with an extra (harmless) snapshot,
 * never a live row with no history. Both writes share one transaction anyway.
 */
export async function publishDraft(
  user: AuthUser,
  actorName: string,
  summary: string
): Promise<PublishedEnvelope> {
  const draft = await getDraft();
  const live = await getLive();
  const version = (live?.version ?? 0) + 1;

  const envelope: PublishedEnvelope = {
    version,
    content: draft.content,
    publishedAt: new Date().toISOString(),
    publishedById: user.userId,
    publishedBy: actorName,
    summary,
  };

  const payload = JSON.stringify(envelope);

  await prisma.$transaction([
    prisma.page.upsert({
      where: { slug: versionSlug(version) },
      update: { content: payload, title: `Homepage — v${version}`, isPublished: false },
      create: {
        slug: versionSlug(version),
        title: `Homepage — v${version}`,
        content: payload,
        isPublished: false,
      },
    }),
    prisma.page.upsert({
      where: { slug: SLUG_LIVE },
      update: { content: payload, title: "Homepage — live", isPublished: true },
      create: { slug: SLUG_LIVE, title: "Homepage — live", content: payload, isPublished: true },
    }),
  ]);

  return envelope;
}

/**
 * Roll back by loading an old version INTO THE DRAFT — deliberately not straight
 * to live. Restoring is an edit like any other: the Super Admin previews it and
 * then publishes, which keeps the "nothing goes live without a publish" rule
 * true even for rollbacks, and records the rollback as its own new version.
 */
export async function restoreVersionToDraft(
  version: number,
  actorName: string
): Promise<{ draft: DraftEnvelope; restored: PublishedEnvelope } | null> {
  const snapshot = await getVersion(version);
  if (!snapshot) return null;

  const draft = await saveDraft(snapshot.content, actorName);
  return { draft, restored: snapshot };
}

/* ─── Media library ────────────────────────────────────────────────────────── */

export async function getMediaLibrary(): Promise<MediaLibrary> {
  const parsed = MediaLibrarySchema.safeParse(parseJson(await readRow(SLUG_MEDIA)));
  return parsed.success ? parsed.data : { items: [] };
}

async function saveMediaLibrary(library: MediaLibrary): Promise<MediaLibrary> {
  await writeRow(SLUG_MEDIA, "Homepage — media library", JSON.stringify(library), false);
  return library;
}

/**
 * Index an already-uploaded image. Uploading itself still goes through the
 * existing /api/v1/upload route — this only records the URL it returned.
 *
 * De-duplication: the same URL is never indexed twice. Re-adding a URL that was
 * soft-deleted un-deletes it instead of creating a second entry.
 */
export async function addMediaItem(
  item: Omit<MediaItem, "id" | "deleted">
): Promise<{ library: MediaLibrary; item: MediaItem; duplicate: boolean }> {
  const library = await getMediaLibrary();
  const existing = library.items.find((m) => m.url === item.url);

  if (existing) {
    existing.deleted = false;
    existing.name = item.name || existing.name;
    existing.alt = item.alt || existing.alt;
    existing.category = item.category || existing.category;
    await saveMediaLibrary(library);
    return { library, item: existing, duplicate: true };
  }

  const created: MediaItem = { ...item, id: `media-${Date.now().toString(36)}-${library.items.length + 1}`, deleted: false };
  library.items.unshift(created);
  await saveMediaLibrary(library);
  return { library, item: created, duplicate: false };
}

/**
 * Patch one entry. `deleted` is a SOFT flag — the row and the underlying object
 * stay, so "Delete" is always undoable via "Restore".
 */
export async function updateMediaItem(
  id: string,
  patch: Partial<Pick<MediaItem, "name" | "alt" | "category" | "deleted">>
): Promise<MediaItem | null> {
  const library = await getMediaLibrary();
  const item = library.items.find((m) => m.id === id);
  if (!item) return null;

  if (patch.name !== undefined) item.name = patch.name;
  if (patch.alt !== undefined) item.alt = patch.alt;
  if (patch.category !== undefined) item.category = patch.category;
  if (patch.deleted !== undefined) item.deleted = patch.deleted;

  await saveMediaLibrary(library);
  return item;
}

/* ─── Validation helper shared by the routes ───────────────────────────────── */

export function parseHomeContent(input: unknown) {
  return HomeContentSchema.safeParse(input);
}
