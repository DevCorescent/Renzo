import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { resolveWorkerId } from "@/lib/worker-scope";
import { getProfessionalSummary } from "@/lib/portfolio";

// OWNER: Gauransh | MODULE: Worker Portfolio
// ROUTE  : /api/v1/worker/portfolio/summary
// METHOD : GET — Read own professional summary (title, experience, description,
//          languages, certificates, specializations, headline rating).
// ACCESS : WORKER (own record only).
// SECURITY / BRANCH ISOLATION: the workerId is resolved from the JWT, never from
//          the request, so a worker can only ever read their own summary — no id
//          is accepted and there is nothing to enumerate.
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const summary = await getProfessionalSummary(workerId);
    if (!summary) return err("Worker profile not found", 404);

    return ok(summary);
  } catch {
    return err("Internal server error", 500);
  }
}
