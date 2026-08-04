// ============================================================================
// MODULE : Manual Operations — global search
// ROUTE  : /api/v1/admin/operations/search?q=&base=
//
// One query box across customers, appointments, invoices, workers and products.
// `base` is the caller's role prefix (e.g. "/reception"), used only to build the
// link each hit points at — it never widens what the search can see.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN, RECEPTIONIST.
// ============================================================================

import { NextRequest } from "next/server";
import { err, ok } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { globalSearch } from "@/lib/operations-service";
import { operationsCapabilitiesFor } from "@/lib/operations";

/** Only role prefixes the app actually serves — never an arbitrary caller string. */
const ALLOWED_BASES = new Set(["/reception", "/branch-admin", "/super-admin"]);

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN",
    "RECEPTIONIST"
  );
  if (error) return error;

  const url = new URL(req.url);
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  if (!operationsCapabilitiesFor(user.userType).canAccess) {
    return err("Forbidden — your role cannot use manual operations", 403);
  }

  try {
    const q = url.searchParams.get("q")?.trim() ?? "";
    const baseRaw = url.searchParams.get("base")?.trim() ?? "";

    // An unrecognised base would put an attacker-chosen string into an href, so
    // it is whitelisted rather than trusted.
    const base = ALLOWED_BASES.has(baseRaw) ? baseRaw : "/reception";

    const hits = await globalSearch(q, scope, base);
    return ok({ items: hits });
  } catch {
    return err("Internal server error", 500);
  }
}
