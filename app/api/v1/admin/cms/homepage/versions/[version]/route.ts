// ============================================================================
// OWNER  : Gauransh
// MODULE : Super Admin — Homepage CMS (single version / rollback)
//
// GET  read a snapshot in full — used to compare an old version against the draft.
// POST restore it INTO THE DRAFT.
//
// Restore deliberately does NOT go straight live. A rollback is an edit like any
// other: it lands in the draft, the Super Admin previews it, then publishes — so
// the "nothing reaches the public without an explicit publish" rule holds even
// here, and the rollback itself is recorded as its own new version.
//
// ACCESS: SUPER_ADMIN only.
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { resolveActorName } from "@/lib/cms/actor";
import { getVersion, restoreVersionToDraft } from "@/lib/cms/store";

function parseVersion(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ version: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN");
  if (error) return error;

  try {
    const version = parseVersion((await params).version);
    if (version === null) return err("Invalid version number", 400);

    const snapshot = await getVersion(version);
    if (!snapshot) return err("Version not found", 404);

    return ok({ version: snapshot }, "Version fetched successfully");
  } catch {
    return err("Internal server error", 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ version: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN");
  if (error) return error;

  try {
    const version = parseVersion((await params).version);
    if (version === null) return err("Invalid version number", 400);

    const actorName = await resolveActorName(user);
    const result = await restoreVersionToDraft(version, actorName);
    if (!result) return err("Version not found", 404);

    await writeAudit(user, {
      action: "RESTORE",
      module: "CMS_HOMEPAGE",
      refId: `homepage-v${version}`,
      refType: "HOMEPAGE_VERSION",
      newValue: { restoredVersion: version, into: "draft" },
    });

    return ok(
      { draft: result.draft },
      `Version ${version} loaded into the draft — preview it, then publish to make it live`
    );
  } catch {
    return err("Internal server error", 500);
  }
}
