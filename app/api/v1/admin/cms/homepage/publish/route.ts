// ============================================================================
// OWNER  : Gauransh
// MODULE : Super Admin — Homepage CMS (publish)
//
// POST /api/v1/admin/cms/homepage/publish
//
// The ONE place the public homepage can change. It promotes the current draft to
// live and snapshots it as an immutable, numbered version in the same transaction.
// Until this runs, editing is invisible to visitors.
//
// ACCESS: SUPER_ADMIN only.
// ============================================================================

import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { readJson } from "@/lib/validate";
import { resolveActorName } from "@/lib/cms/actor";
import { getLive, publishDraft } from "@/lib/cms/store";

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN");
  if (error) return error;

  try {
    const body = (await readJson(req)) as { summary?: unknown } | null;
    const summary =
      typeof body?.summary === "string" ? body.summary.trim().slice(0, 300) : "";

    const previous = await getLive();
    const actorName = await resolveActorName(user);
    const published = await publishDraft(user, actorName, summary);

    await writeAudit(user, {
      action: "PUBLISH",
      module: "CMS_HOMEPAGE",
      refId: `homepage-v${published.version}`,
      refType: "HOMEPAGE_VERSION",
      oldValue: previous ? { version: previous.version, publishedAt: previous.publishedAt } : { version: 0 },
      newValue: { version: published.version, publishedAt: published.publishedAt, summary },
    });

    // The public homepage renders published content, so its cache entry is stale
    // the moment a publish lands. Revalidating here is what makes "Publish" feel
    // immediate instead of waiting for a natural cache miss.
    revalidatePath("/");

    return ok(
      { version: published.version, publishedAt: published.publishedAt, publishedBy: published.publishedBy },
      `Published version ${published.version} — the homepage is now live`
    );
  } catch {
    return err("Internal server error", 500);
  }
}
