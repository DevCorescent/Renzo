import { NextRequest } from "next/server";
import { created, err, ok } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Worker Availability
// GET /api/v1/admin/workers/[id]/availability — List worker availability blocks
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const dateFilter =
      from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {};

    const blocks = await prisma.workerAvailability.findMany({
      where: { workerId: id, ...dateFilter },
      orderBy: { date: "asc" },
    });
    return ok(blocks);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/workers/[id]/availability — Add a worker unavailability block
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.date) return err("date is required", 422);
    const date = new Date(body.date);
    if (isNaN(date.getTime())) return err("date is not a valid date", 422);

    const worker = await prisma.workerProfile.findUnique({ where: { id }, select: { id: true } });
    if (!worker) return err("Worker not found", 404);

    const block = await prisma.workerAvailability.create({
      data: {
        workerId: id,
        branchId: body.branchId ?? null,
        date,
        fromTime: body.fromTime ?? null, // null = full-day block
        toTime: body.toTime ?? null,
        reason: body.reason ?? null,
      },
    });

    return created(block);
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2003") {
      return err("Invalid branchId", 422);
    }
    return err("Internal server error", 500);
  }
}
