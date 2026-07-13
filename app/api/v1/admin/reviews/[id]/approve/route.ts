import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { recomputeRatingSummary } from "@/lib/ratings";

// OWNER: Shalmon | MODULE: Reviews — Approve
// POST /api/v1/admin/reviews/[id]/approve
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) return err("Review not found", 404);

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.review.update({
        where: { id },
        data: {
          status: "APPROVED",
          isPublic: true,
          approvedBy: user.userId,
          approvedAt: new Date(),
          rejectionReason: null,
        },
      });
      // Refresh denormalized rating caches for every scope this review touches.
      await recomputeRatingSummary(tx, { branchId: r.branchId });
      if (r.workerId) await recomputeRatingSummary(tx, { workerId: r.workerId });
      if (r.serviceId) await recomputeRatingSummary(tx, { serviceId: r.serviceId });
      return r;
    });

    return ok(updated, "Review approved");
  } catch {
    return err("Internal server error", 500);
  }
}
