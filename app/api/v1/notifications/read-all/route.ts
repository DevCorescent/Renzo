import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Enterprise Notification Center
// ROUTE : /api/v1/notifications/read-all
//
// METHOD: POST — Mark ALL of the caller's unread notifications as read in one
//         atomic write. Scoped to `readAt: null` so it never re-stamps rows that
//         were already read (keeps the original read time intact) and only ever
//         touches the caller's own rows.
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  try {
    const result = await prisma.notification.updateMany({
      where: { userId: user.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return ok({ count: result.count }, "All notifications marked read");
  } catch {
    return err("Internal server error", 500);
  }
}
