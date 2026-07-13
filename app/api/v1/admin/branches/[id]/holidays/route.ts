import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Branch Holidays
// GET /api/v1/admin/branches/[id]/holidays — List holidays for a branch
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const { page, limit, skip } = parsePagination(new URL(req.url));

    const where = { branchId: id };
    const [items, total] = await Promise.all([
      prisma.branchHoliday.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: "asc" },
      }),
      prisma.branchHoliday.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/branches/[id]/holidays — Add a holiday for a branch
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.date) return err("date is required", 422);
    const date = new Date(body.date);
    if (isNaN(date.getTime())) return err("date is not a valid date", 422);

    // Guard against orphan holidays for a non-existent branch.
    const branch = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
    if (!branch) return err("Branch not found", 404);

    const holiday = await prisma.branchHoliday.create({
      data: {
        branchId: id,
        date,
        reason: body.reason ?? null,
      },
    });

    return created(holiday);
  } catch {
    return err("Internal server error", 500);
  }
}
