// ============================================================================
// OWNER  : Gauransh
// MODULE : Super Admin — Homepage CMS (media item)
//
// PATCH  rename / re-categorise / edit alt text, or set `deleted`.
// DELETE soft-delete (identical to PATCH { deleted: true }, kept because DELETE is
//        what the UI's delete button naturally speaks).
//
// Deletion is ALWAYS soft: the entry is flagged, never dropped, and the stored
// object is never removed — so "Restore" is a one-field flip and a published page
// still pointing at that URL keeps rendering. A destructive purge is deliberately
// not offered.
//
// ACCESS: SUPER_ADMIN only.
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { readJson } from "@/lib/validate";
import { updateMediaItem } from "@/lib/cms/store";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const body = (await readJson(req)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") return err("Invalid request body", 400);

    const patch: { name?: string; alt?: string; category?: string; deleted?: boolean } = {};
    if (typeof body.name === "string") patch.name = body.name.trim().slice(0, 300);
    if (typeof body.alt === "string") patch.alt = body.alt.trim().slice(0, 300);
    if (typeof body.category === "string") patch.category = body.category.trim().slice(0, 300) || "General";
    if (typeof body.deleted === "boolean") patch.deleted = body.deleted;

    if (Object.keys(patch).length === 0) return err("No fields provided to update", 400);

    const item = await updateMediaItem(id, patch);
    if (!item) return err("Media item not found", 404);

    await writeAudit(user, {
      action: patch.deleted === true ? "DELETE" : patch.deleted === false ? "RESTORE" : "UPDATE",
      module: "CMS_MEDIA",
      refId: item.id,
      refType: "CMS_MEDIA_ITEM",
      newValue: { ...patch },
    });

    return ok({ item }, patch.deleted === false ? "Image restored" : "Image updated");
  } catch {
    return err("Internal server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const item = await updateMediaItem(id, { deleted: true });
    if (!item) return err("Media item not found", 404);

    await writeAudit(user, {
      action: "DELETE",
      module: "CMS_MEDIA",
      refId: item.id,
      refType: "CMS_MEDIA_ITEM",
      newValue: { url: item.url, deleted: true },
    });

    return ok({ item }, "Image removed — you can restore it from the library");
  } catch {
    return err("Internal server error", 500);
  }
}
