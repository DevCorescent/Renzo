import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { resolveWorkerId } from "@/lib/worker-scope";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Worker Portfolio
// ROUTE  : /api/v1/worker/portfolio/reviews
// METHOD : GET — Own professional reviews (APPROVED only), paginated and sortable.
// ACCESS : WORKER (own record only).
// SECURITY / BRANCH ISOLATION: workerId comes from the JWT, not the request. Only
//          APPROVED reviews are returned — pending / rejected feedback stays with
//          admin moderation (admin/reviews) and never surfaces here, and customer
//          contact details are never selected.

// Whitelisted so a caller cannot order by an arbitrary column and force an
// unindexed sort. Newest-first by default — the natural order for a feed.
const SORTABLE = new Set(["createdAt", "overallRating"]);

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const workerId = await resolveWorkerId(user);
    if (!workerId) return err("Worker profile not found", 404);

    const url = new URL(req.url);
    const { page, limit, skip } = parsePagination(url);

    const sortByRaw = url.searchParams.get("sortBy") ?? "createdAt";
    const sortBy = SORTABLE.has(sortByRaw) ? sortByRaw : "createdAt";
    const sortOrder: Prisma.SortOrder =
      url.searchParams.get("sortOrder")?.toLowerCase() === "asc" ? "asc" : "desc";

    const where: Prisma.ReviewWhereInput = { workerId, status: "APPROVED" };

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ [sortBy]: sortOrder }, { id: "asc" }],
        select: {
          id: true,
          overallRating: true,
          serviceRating: true,
          comment: true,
          adminReply: true,
          createdAt: true,
          serviceId: true,
          // First name only — enough to attribute the review without exposing the
          // customer's identity or contact details.
          customer: { select: { firstName: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);

    // Review has a serviceId scalar but no service relation, so names are resolved
    // in ONE batched lookup for the whole page — not a query per row.
    const serviceIds = [...new Set(items.map((i) => i.serviceId).filter((v): v is string => Boolean(v)))];
    const services = serviceIds.length
      ? await prisma.service.findMany({ where: { id: { in: serviceIds } }, select: { id: true, name: true } })
      : [];
    const nameById = new Map(services.map((s) => [s.id, s.name]));

    const shaped = items.map(({ serviceId, ...rest }) => ({
      ...rest,
      serviceName: serviceId ? nameById.get(serviceId) ?? null : null,
    }));

    return paginated(shaped, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
