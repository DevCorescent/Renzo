// ============================================================================
// OWNER  : Gauransh
// MODULE : Super Admin — Homepage CMS (media library)
//
// GET  list indexed images (optionally including soft-deleted ones).
// POST index an image that was ALREADY uploaded through /api/v1/upload.
//
// This route stores no bytes and talks to no storage provider. Uploading remains
// the existing Cloudflare R2 route, unchanged; the library is only an index over
// the URLs it returned, plus the authoring metadata the CMS needs (section,
// alt text, category). Re-indexing a URL that already exists updates that entry
// instead of creating a duplicate.
//
// ACCESS: SUPER_ADMIN only.
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { readJson } from "@/lib/validate";
import { resolveActorName } from "@/lib/cms/actor";
import { getMediaLibrary, addMediaItem } from "@/lib/cms/store";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN");
  if (error) return error;

  try {
    const includeDeleted = new URL(req.url).searchParams.get("includeDeleted") === "true";
    const library = await getMediaLibrary();
    const items = includeDeleted ? library.items : library.items.filter((m) => !m.deleted);
    return ok({ items }, "Media library fetched successfully");
  } catch {
    return err("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN");
  if (error) return error;

  try {
    const body = (await readJson(req)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return err("Invalid request body", 400);

    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) return err("Validation failed", 422, { url: ["An image URL is required"] });

    const str = (v: unknown, fallback = "") =>
      typeof v === "string" ? v.trim().slice(0, 300) : fallback;

    const actorName = await resolveActorName(user);
    const { item, duplicate } = await addMediaItem({
      url,
      name: str(body.name) || url.split("/").pop() || "Image",
      alt: str(body.alt),
      category: str(body.category) || "General",
      uploadedAt: new Date().toISOString(),
      uploadedBy: actorName,
    });

    await writeAudit(user, {
      action: duplicate ? "UPDATE" : "CREATE",
      module: "CMS_MEDIA",
      refId: item.id,
      refType: "CMS_MEDIA_ITEM",
      newValue: { url: item.url, category: item.category, duplicate },
    });

    return ok(
      { item, duplicate },
      duplicate ? "This image was already in the library — reusing it" : "Image added to the library"
    );
  } catch {
    return err("Internal server error", 500);
  }
}
