import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Public Workers
// GET /api/v1/public/workers/[slug] — Get single worker public profile by id (no auth)
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
      },
    });
    if (!worker) return err("Worker not found", 404);

    return ok(worker);
  } catch {
    return err("Internal server error", 500);
  }
}
