import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { recomputeRatingSummary } from "@/lib/ratings";

// OWNER: Shalmon | MODULE: Reviews — Reject
// POST /api/v1/admin/reviews/[id]/reject  { reason }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const reason: string = body && typeof body.reason === "string" ? body.reason.trim() : "";

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) return err("Review not found", 404);

    const wasApproved = review.status === "APPROVED";

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.review.update({
        where: { id },
        data: {
          status: "REJECTED",
          isPublic: false,
          rejectionReason: reason || null,
          approvedBy: user.userId,
          approvedAt: new Date(),
        },
      });
      // If it had been public, its stars must be removed from the caches.
      if (wasApproved) {
        await recomputeRatingSummary(tx, { branchId: r.branchId });
        if (r.workerId) await recomputeRatingSummary(tx, { workerId: r.workerId });
        if (r.serviceId) await recomputeRatingSummary(tx, { serviceId: r.serviceId });
      }
      return r;
    });

    return ok(updated, "Review rejected");
  } catch {
    return err("Internal server error", 500);
  }
}
