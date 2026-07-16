import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Enterprise Notification Center
// ROUTE : /api/v1/notifications/unread-count
//
// METHOD: GET — Just the unread count, for the bell badge. A dedicated, index-only
//         endpoint so the badge can poll cheaply without pulling the whole feed —
//         one COUNT on the [userId, readAt] index, nothing more.
//
// SECURITY: scoped to the caller's own userId from the JWT.
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  try {
    const count = await prisma.notification.count({
      where: { userId: user.userId, readAt: null },
    });
    return ok({ count });
  } catch {
    return err("Internal server error", 500);
  }
}
