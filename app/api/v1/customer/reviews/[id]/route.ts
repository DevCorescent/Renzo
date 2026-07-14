import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { recomputeRatingSummary } from "@/lib/ratings";

// Optional 1–5 sub-rating (same rule as POST /customer/reviews).
function subRating(v: unknown): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

// OWNER: Aman | MODULE: Customer Reviews — Edit
// PATCH /api/v1/customer/reviews/[id] — Edit your own review.
//
// Editing an already-APPROVED review sends it back to PENDING: the text is
// changing, so it has to pass moderation again (otherwise "edit" would be a
// hole straight through the admin approval flow). The rating caches are
// recomputed in the same transaction, so a stylist's average always reflects
// only the reviews that are currently approved.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;
  if (!user.customerId) return err("Customer profile not found", 403);
  const customerId = user.customerId;

  try {
    const { id } = await params;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const existing = await prisma.review.findUnique({ where: { id } });
    if (!existing) return err("Review not found", 404);

    // A customer may only ever touch their own review.
    if (existing.customerId !== customerId) {
      return err("Forbidden — this review belongs to another customer", 403);
    }

    const overallRating = Number(body.overallRating);
    if (!Number.isInteger(overallRating) || overallRating < 1 || overallRating > 5) {
      return err("Validation failed", 422, {
        overallRating: ["overallRating must be an integer between 1 and 5"],
      });
    }

    const wasApproved = existing.status === "APPROVED";

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.review.update({
        where: { id },
        data: {
          overallRating,
          serviceRating: subRating(body.serviceRating),
          workerRating: subRating(body.workerRating),
          branchRating: subRating(body.branchRating),
          cleanliness: subRating(body.cleanliness),
          punctuality: subRating(body.punctuality),
          comment: typeof body.comment === "string" ? body.comment : null,
          images: Array.isArray(body.images)
            ? body.images.filter((i: unknown) => typeof i === "string")
            : existing.images,
          // Edited content must be re-moderated before it goes public again.
          status: "PENDING",
          isPublic: false,
          approvedBy: null,
          approvedAt: null,
        },
      });

      // If it had been counted in the public averages, drop it back out now.
      if (wasApproved) {
        await recomputeRatingSummary(tx, { branchId: r.branchId });
        if (r.workerId) await recomputeRatingSummary(tx, { workerId: r.workerId });
        if (r.serviceId) await recomputeRatingSummary(tx, { serviceId: r.serviceId });
      }

      return r;
    });

    return ok(updated, "Review updated — pending moderation");
  } catch {
    return err("Internal server error", 500);
  }
}
