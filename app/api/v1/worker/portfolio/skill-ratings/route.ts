import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { resolveWorkerId } from "@/lib/worker-scope";
import { getSkillRatings } from "@/lib/portfolio";

// OWNER: Gauransh | MODULE: Worker Portfolio
// ROUTE  : /api/v1/worker/portfolio/skill-ratings
// METHOD : GET — Own per-service ratings, averaged from APPROVED customer reviews.
//          Always calculated, never stored: a worker cannot inflate a skill, and a
//          cancelled or deleted booking (no approved review) contributes nothing.
// ACCESS : WORKER (own record only).
// SECURITY / BRANCH ISOLATION: workerId is resolved from the JWT, not the request.
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const ratings = await getSkillRatings(workerId);
    return ok(ratings);
  } catch {
    return err("Internal server error", 500);
  }
}
