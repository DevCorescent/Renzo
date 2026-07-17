import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Enterprise Notification Center
// ROUTE : /api/v1/notifications/[id]
//
// METHOD: PATCH — Mark one notification as read (typically on click-through).
//
// SECURITY: the ownership filter { id, userId } IS the write, so a foreign id
// simply matches nothing (404) — a user can never read-flag another user's row.
// Idempotent: re-marking an already-read row is a no-op that still returns 200.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  try {
    const { id } = await params;

    const result = await prisma.notification.updateMany({
      where: { id, userId: user.userId, readAt: null },
      data: { readAt: new Date() },
    });

    // count 0 means either it does not exist for this user, or it was already read.
    // Distinguish the two so a genuine 404 is honest without leaking other users' ids.
    if (result.count === 0) {
      const exists = await prisma.notification.findFirst({
        where: { id, userId: user.userId },
        select: { id: true },
      });
      if (!exists) return err("Notification not found", 404);
    }

    return ok(null, "Notification marked read");
  } catch {
    return err("Internal server error", 500);
  }
}
