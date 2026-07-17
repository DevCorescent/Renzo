import { NextRequest } from "next/server";
import type { Prisma, NotificationType } from "@prisma/client";
import { err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Enterprise Notification Center
// ROUTE : /api/v1/notifications
//
// METHOD: GET — The signed-in user's OWN notification feed, paginated, with
//         read/unread, type and date filters. Any authenticated role uses the same
//         endpoint — a notification belongs to a User, not a role.
//
// SECURITY: scoped to userId from the JWT, never the request. A user can only ever
// read their own notifications — nothing to enumerate, no cross-user leakage.

const TYPES = ["INFO", "SUCCESS", "WARNING", "ERROR", "SYSTEM"];

/** A parseable date param, or undefined. */
function parseDate(v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(req: NextRequest) {
  // No role list: every authenticated user has a feed.
  const { user, error } = await requireAuth(req);
  if (error) return error;

  try {
    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url);

    const filter = url.searchParams.get("filter"); // "unread" | "read" | (all)
    const typeParam = url.searchParams.get("type");
    const type = typeParam && TYPES.includes(typeParam) ? (typeParam as NotificationType) : undefined;
    const from = parseDate(url.searchParams.get("from"));
    const to = parseDate(url.searchParams.get("to"));

    const where: Prisma.NotificationWhereInput = {
      userId: user.userId,
      ...(filter === "unread" ? { readAt: null } : filter === "read" ? { readAt: { not: null } } : {}),
      ...(type ? { type } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        // Unread first, then newest — the order a notification centre reads best.
        orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
      }),
      prisma.notification.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
