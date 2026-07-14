import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Public Workers — Reviews
// GET /api/v1/public/workers/[slug]/reviews — Approved, public reviews for one
// stylist (no auth). Moderation is respected: PENDING / REJECTED reviews and
// any review an admin has kept private are never exposed here.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { page, limit, skip } = parsePagination(new URL(req.url));

    const worker = await prisma.workerProfile.findFirst({
      where: { id: slug, isPublic: true, isActive: true },
      select: { id: true },
    });
    if (!worker) return err("Worker not found", 404);

    const where = {
      workerId: worker.id,
      status: "APPROVED" as const,
      isPublic: true,
    };

    const [items, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          overallRating: true,
          workerRating: true,
          comment: true,
          images: true,
          adminReply: true,
          createdAt: true,
          // First name only — never leak a customer's full identity publicly.
          customer: { select: { firstName: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
