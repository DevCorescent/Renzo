import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

type TimingInput = {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isOpen?: boolean;
  slotDuration?: number;
};

// OWNER: Aman | MODULE: Branch Timings
// GET /api/v1/admin/branches/[id]/timings — Get all 7-day timings for a branch
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const timings = await prisma.branchTiming.findMany({
      where: { branchId: id },
      orderBy: { dayOfWeek: "asc" },
    });
    return ok(timings);
  } catch {
    return err("Internal server error", 500);
  }
}

// PUT /api/v1/admin/branches/[id]/timings — Bulk upsert day timings
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();

    const days: TimingInput[] = Array.isArray(body) ? body : body.timings;
    if (!Array.isArray(days) || days.length === 0) {
      return err("Expected a non-empty array of day timings", 422);
    }

    // Validate each entry before touching the DB.
    for (const d of days) {
      if (
        typeof d.dayOfWeek !== "number" ||
        d.dayOfWeek < 0 ||
        d.dayOfWeek > 6
      ) {
        return err("Each timing needs a dayOfWeek between 0 (Sun) and 6 (Sat)", 422);
      }
      if (!d.openTime || !d.closeTime) {
        return err(`Day ${d.dayOfWeek} is missing openTime or closeTime`, 422);
      }
    }

    // Guard against orphan timings for a non-existent branch.
    const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
    if (!branch) return err("Branch not found", 404);

    await prisma.$transaction(
      days.map((d) =>
        prisma.branchTiming.upsert({
          where: { branchId_dayOfWeek: { branchId: id, dayOfWeek: d.dayOfWeek } },
          update: {
            openTime: d.openTime,
            closeTime: d.closeTime,
            isOpen: d.isOpen ?? true,
            slotDuration: d.slotDuration ?? 30,
          },
          create: {
            branchId: id,
            dayOfWeek: d.dayOfWeek,
            openTime: d.openTime,
            closeTime: d.closeTime,
            isOpen: d.isOpen ?? true,
            slotDuration: d.slotDuration ?? 30,
          },
        })
      )
    );

    const timings = await prisma.branchTiming.findMany({
      where: { branchId: id },
      orderBy: { dayOfWeek: "asc" },
    });
    return ok(timings, "Timings updated");
  } catch {
    return err("Internal server error", 500);
  }
}
