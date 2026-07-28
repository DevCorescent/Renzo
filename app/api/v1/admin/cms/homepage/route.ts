// ============================================================================
// OWNER  : Gauransh
// MODULE : Super Admin — Homepage CMS (draft document)
//
// GET    load the editor: draft + what is currently live + version history.
// PUT    save the draft. NEVER affects the public homepage.
// DELETE discard the draft and reset it to whatever is live.
//
// ACCESS : SUPER_ADMIN only. Every other role — including OWNER and BRANCH_ADMIN —
//          gets the existing 403 envelope, so no other role can read, edit or even
//          confirm the module exists.
// BACKEND: lib/cms/store.ts, which writes only the previously-unused `Page` model.
//          No schema change, no new table, no existing model touched.
// AUDIT  : writeAudit(module "CMS_HOMEPAGE") — the existing AuditLog, reused.
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { writeAudit } from "@/lib/audit";
import { readJson } from "@/lib/validate";
import { resolveActorName } from "@/lib/cms/actor";
import {
  getDraft,
  getLive,
  saveDraft,
  discardDraft,
  listVersions,
  parseHomeContent,
} from "@/lib/cms/store";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN");
  if (error) return error;

  try {
    const [draft, live, versions] = await Promise.all([getDraft(), getLive(), listVersions()]);
    return ok({ draft, live, versions }, "Homepage content fetched successfully");
  } catch {
    return err("Internal server error", 500);
  }
}

export async function PUT(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN");
  if (error) return error;

  try {
    const body = (await readJson(req)) as { content?: unknown } | null;
    if (!body || typeof body !== "object") return err("Invalid request body", 400);

    // The document is validated server-side and authoritatively: the client cannot
    // store a shape the renderer is unable to handle, and cannot smuggle in a key
    // the schema does not describe (styling fields simply do not exist here).
    const parsed = parseHomeContent(body.content);
    if (!parsed.success) {
      return err("Validation failed", 422, {
        content: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join(".") || "content"}: ${i.message}`),
      });
    }

    const previous = await getDraft();
    const actorName = await resolveActorName(user);
    const draft = await saveDraft(parsed.data, actorName);

    await writeAudit(user, {
      action: "UPDATE",
      module: "CMS_HOMEPAGE",
      refId: "homepage-draft",
      refType: "HOMEPAGE_DRAFT",
      oldValue: { sections: previous.content.sections.map((s) => ({ id: s.id, type: s.type, enabled: s.enabled })) },
      newValue: { sections: draft.content.sections.map((s) => ({ id: s.id, type: s.type, enabled: s.enabled })) },
    });

    return ok({ draft }, "Draft saved");
  } catch {
    return err("Internal server error", 500);
  }
}

export async function DELETE(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN");
  if (error) return error;

  try {
    const actorName = await resolveActorName(user);
    const draft = await discardDraft(actorName);

    await writeAudit(user, {
      action: "DELETE",
      module: "CMS_HOMEPAGE",
      refId: "homepage-draft",
      refType: "HOMEPAGE_DRAFT",
      newValue: { discarded: true },
    });

    return ok({ draft }, "Draft discarded — reset to the live homepage");
  } catch {
    return err("Internal server error", 500);
  }
}
