// OWNER: Gauransh | MODULE: Super Admin — Homepage CMS (version history)
//
// GET /api/v1/admin/cms/homepage/versions
// Version number, who published it, when, and the summary they wrote — newest
// first, with the currently-live version flagged. SUPER_ADMIN only.

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { listVersions } from "@/lib/cms/store";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(req, "SUPER_ADMIN");
  if (error) return error;

  try {
    return ok({ versions: await listVersions() }, "Version history fetched successfully");
  } catch {
    return err("Internal server error", 500);
  }
}
