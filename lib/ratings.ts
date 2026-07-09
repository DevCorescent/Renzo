import type { Prisma } from "@prisma/client";

// OWNER: Shalmon | MODULE: Reviews — denormalized rating cache
// Recomputes a RatingSummary row from APPROVED reviews for one scope
// (a branch, a worker, or a service). Call inside the approval transaction.

type Tx = Prisma.TransactionClient;
type Scope = { branchId: string } | { workerId: string } | { serviceId: string };

export async function recomputeRatingSummary(tx: Tx, scope: Scope) {
  const reviews = await tx.review.findMany({
    where: { ...scope, status: "APPROVED" },
    select: { overallRating: true },
  });

  const star = [0, 0, 0, 0, 0]; // index 0 => 1★ … index 4 => 5★
  let sum = 0;
  for (const r of reviews) {
    sum += r.overallRating;
    if (r.overallRating >= 1 && r.overallRating <= 5) star[r.overallRating - 1]++;
  }
  const total = reviews.length;

  const payload = {
    totalReviews: total,
    averageRating: total ? Number((sum / total).toFixed(2)) : 0,
    oneStarCount: star[0],
    twoStarCount: star[1],
    threeStarCount: star[2],
    fourStarCount: star[3],
    fiveStarCount: star[4],
  };

  await tx.ratingSummary.upsert({
    where: scope as Prisma.RatingSummaryWhereUniqueInput,
    update: payload,
    create: { ...scope, ...payload },
  });
}
