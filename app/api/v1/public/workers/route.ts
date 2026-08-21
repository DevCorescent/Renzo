import { NextRequest } from "next/server";
import { err, paginated, parsePagination } from "@/lib/response";
import prisma from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { DATE_RE, getWorkerSlots, parseRequestedServiceIds } from "@/lib/slots";

// OWNER: Aman | MODULE: Public Workers
// GET /api/v1/public/workers — List public worker profiles (no auth)
//
// Query: ?branchId= &serviceId= &serviceIds= &date= &search= &page= &limit=
//
// Passing `branchId` + one or more service IDs turns this into the booking
// flow's stylist picker: only stylists who work at that branch AND are
// qualified for EVERY requested service (WorkerService, isActive) come back,
// each with their rating and next free slot for `date` (default today).
// Stylists who cannot perform all selected services are never listed.
//
// `serviceId` remains for existing single-service callers. `serviceIds` may
// be repeated (`serviceIds=a&serviceIds=b`) or comma-separated.

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const { page, limit, skip, search } = parsePagination(url);
    const branchId = url.searchParams.get("branchId")?.trim() || undefined;
    const serviceIds = parseRequestedServiceIds(url);
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
      // AND across WorkerService rows: the stylist must offer every selected
      // service. `some` per id is the Prisma equivalent of "has all of these".
      ...(serviceIds.length
        ? {
            AND: serviceIds.map((serviceId) => ({
              services: {
                some: {
                  serviceId,
                  isActive: true,
                  service: { isActive: true },
                },
              },
            })),
          }
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

    if (branchId && serviceIds.length > 0 && items.length > 0) {
      const dbServices = await prisma.service.findMany({
        where: { id: { in: serviceIds }, isActive: true },
        select: { duration: true },
      });

      if (dbServices.length === serviceIds.length) {
        const durationMinutes = dbServices.reduce(
          (sum, s) => sum + s.duration,
          0,
        );
        const { byWorker } = await getWorkerSlots({
          branchId,
          date,
          durationMinutes,
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
