import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { DATE_RE, getWorkerSlots } from "@/lib/slots";

// OWNER: Aman | MODULE: Public Workers
// GET /api/v1/public/workers — List public worker profiles (no auth)
//
// Query: ?branchId= &serviceId= &date= &search= &page= &limit=
//
// Passing `branchId` + `serviceId` turns this into the booking flow's stylist
// picker: only stylists who work at that branch AND are qualified for that
// service come back, each with their rating and next free slot for `date`
// (default today). Stylists who cannot perform the service are never listed.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);
    const branchId = url.searchParams.get("branchId")?.trim() || undefined;
    const serviceId = url.searchParams.get("serviceId")?.trim() || undefined;
    const dateParam = url.searchParams.get("date")?.trim();

    const date =
      dateParam && DATE_RE.test(dateParam)
        ? dateParam
        : new Date().toISOString().slice(0, 10);

    const where: Prisma.WorkerProfileWhereInput = {
      isPublic: true,
      isActive: true,
      ...(branchId
        ? { branches: { some: { branchId, isActive: true } } }
        : {}),
      // Only stylists qualified for the requested service.
      ...(serviceId
        ? { services: { some: { serviceId, isActive: true } } }
        : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" as const } },
              { lastName: { contains: search, mode: "insensitive" as const } },
              { displayName: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.workerProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          bio: true,
          profilePhoto: true,
          experience: true,
          languages: true,
          designation: { select: { name: true, level: true } },
          skills: { select: { skill: { select: { name: true } }, proficiency: true } },
          ratingSummary: { select: { averageRating: true, totalReviews: true } },
        },
      }),
      prisma.workerProfile.count({ where }),
    ]);

    // Availability only makes sense once we know the branch AND the service
    // (a slot's length is the service duration). Without both, skip the work.
    let withAvailability = items.map((w) => ({
      ...w,
      averageRating: w.ratingSummary?.averageRating ?? 0,
      reviewCount: w.ratingSummary?.totalReviews ?? 0,
      availableToday: null as boolean | null,
      nextSlot: null as string | null,
    }));

    if (branchId && serviceId && items.length > 0) {
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
        select: { duration: true, isActive: true },
      });

      if (service?.isActive) {
        const { byWorker } = await getWorkerSlots({
          branchId,
          date,
          durationMinutes: service.duration,
          workerIds: items.map((w) => w.id),
        });

        withAvailability = withAvailability.map((w) => {
          const slots = byWorker.get(w.id) ?? [];
          return {
            ...w,
            availableToday: slots.length > 0,
            nextSlot: slots[0] ?? null,
          };
        });
      }
    }

    return paginated(withAvailability, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
