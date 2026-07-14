import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Public Workers
// GET /api/v1/public/workers/[slug] — Get single worker public profile by id (no auth)
// Includes the rating summary, the services they offer and how many
// appointments they have completed, so the booking flow can show a full
// stylist detail view before the customer commits to a slot.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const worker = await prisma.workerProfile.findFirst({
      where: { id: slug, isPublic: true, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        bio: true,
        profilePhoto: true,
        experience: true,
        languages: true,
        certificates: true,
        designation: { select: { name: true, level: true } },
        skills: { select: { skill: { select: { name: true } }, proficiency: true } },
        // Only surface admin-approved portfolio work publicly.
        portfolios: {
          where: { isApproved: true },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            category: true,
            title: true,
            description: true,
            beforeImage: true,
            afterImage: true,
          },
        },
        // Services this stylist is qualified for.
        services: {
          where: { isActive: true, service: { isActive: true } },
          select: {
            service: {
              select: { id: true, name: true, slug: true, duration: true, basePrice: true },
            },
          },
        },
        ratingSummary: {
          select: {
            averageRating: true,
            totalReviews: true,
            fiveStarCount: true,
            fourStarCount: true,
            threeStarCount: true,
            twoStarCount: true,
            oneStarCount: true,
          },
        },
      },
    });
    if (!worker) return err("Worker not found", 404);

    const completedServices = await prisma.appointment.count({
      where: { workerId: worker.id, status: "COMPLETED" },
    });

    const { services, ratingSummary, ...rest } = worker;

    return ok({
      ...rest,
      services: services.map((s) => s.service),
      completedServices,
      averageRating: ratingSummary?.averageRating ?? 0,
      reviewCount: ratingSummary?.totalReviews ?? 0,
      ratingDistribution: {
        5: ratingSummary?.fiveStarCount ?? 0,
        4: ratingSummary?.fourStarCount ?? 0,
        3: ratingSummary?.threeStarCount ?? 0,
        2: ratingSummary?.twoStarCount ?? 0,
        1: ratingSummary?.oneStarCount ?? 0,
      },
    });
  } catch {
    return err("Internal server error", 500);
  }
}
