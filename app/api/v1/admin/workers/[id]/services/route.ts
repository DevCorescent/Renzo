import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Worker Services
// GET /api/v1/admin/workers/[id]/services — List services mapped to worker
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const services = await prisma.workerService.findMany({
      where: { workerId: id },
      include: { service: true },
    });
    return ok(services);
  } catch {
    return err("Internal server error", 500);
  }
}

// PUT /api/v1/admin/workers/[id]/services — Replace all mapped services for worker
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();

    const serviceIds: string[] = Array.isArray(body) ? body : body.serviceIds;
    if (!Array.isArray(serviceIds)) {
      return err("Expected an array of service IDs", 422);
    }
    if (serviceIds.some((s) => typeof s !== "string" || !s)) {
      return err("Every entry must be a non-empty service ID", 422);
    }

    const worker = await prisma.workerProfile.findUnique({ where: { id }, select: { id: true } });
    if (!worker) return err("Worker not found", 404);

    await prisma.$transaction([
      prisma.workerService.deleteMany({ where: { workerId: id } }),
      prisma.workerService.createMany({
        data: serviceIds.map((serviceId) => ({ workerId: id, serviceId })),
        skipDuplicates: true,
      }),
    ]);

    const services = await prisma.workerService.findMany({
      where: { workerId: id },
      include: { service: true },
    });
    return ok(services, "Services updated");
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2003") {
      return err("One or more serviceId values do not exist", 422);
    }
    return err("Internal server error", 500);
  }
}
