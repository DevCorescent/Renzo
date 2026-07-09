import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Public Branches
// GET /api/v1/public/branches/[slug] — Get single branch details by slug (no auth)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;

    const branch = await prisma.branch.findFirst({
      where: { slug, isActive: true, isPublic: true },
      include: {
        timings: { orderBy: { dayOfWeek: "asc" } },
        holidays: { orderBy: { date: "asc" } },
      },
    });
    if (!branch) return err("Branch not found", 404);

    return ok(branch);
  } catch {
    return err("Internal server error", 500);
  }
}
