import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { resolveWorkerId } from "@/lib/worker-scope";
import { getStatistics } from "@/lib/portfolio";

// OWNER: Gauransh | MODULE: Worker Portfolio
// ROUTE  : /api/v1/worker/portfolio/statistics
// METHOD : GET — Own professional statistics: completed bookings & services,
//          repeat customers, average rating, revenue, completion / cancellation
//          rates and month-over-month growth. Every figure is CALCULATED from the
//          booking + review history, never stored, so it cannot be hand-edited.
// ACCESS : WORKER (own record only).
// SECURITY / BRANCH ISOLATION: workerId comes from the JWT, not the request — a
//          worker sees only their own numbers.
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const stats = await getStatistics(workerId);
    return ok(stats);
  } catch {
    return err("Internal server error", 500);
  }
}
