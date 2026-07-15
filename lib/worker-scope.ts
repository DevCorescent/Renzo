import prisma from "@/lib/db";
import type { AuthUser } from "@/types/api";

// OWNER: Gauransh | MODULE: Worker — session → workerId
//
// Resolves the caller's WorkerProfile id. The JWT usually carries workerId
// directly; the findUnique is the fallback for a token minted before that claim
// existed. Returns null when the user has no worker profile (a non-worker token,
// or a profile that was removed) so callers can answer 404 instead of crashing.
//
// The worker leave / attendance / appointment / portfolio routes each carry a
// local copy of this; new routes reuse this one rather than duplicating it again.
export async function resolveWorkerId(user: AuthUser): Promise<string | null> {
  if (user.workerId) return user.workerId;
  const wp = await prisma.workerProfile.findUnique({
    where: { userId: user.userId },
    select: { id: true },
  });
  return wp?.id ?? null;
}
