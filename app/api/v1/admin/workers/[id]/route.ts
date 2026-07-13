import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Worker Management
// GET /api/v1/admin/workers/[id] — Get worker by ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const worker = await prisma.workerProfile.findUnique({
      where: { id },
      include: {
        department: true,
        designation: true,
        branches: { include: { branch: { select: { id: true, name: true } } } },
        skills: { include: { skill: true } },
        services: true,
      },
    });
    if (!worker) return err("Worker not found", 404);
    return ok(worker);
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/workers/[id] — Update worker profile
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();

    const allowed = [
      "firstName",
      "lastName",
      "displayName",
      "bio",
      "profilePhoto",
      "phone",
      "email",
      "experience",
      "languages",
      "certificates",
      "isPublic",
      "isActive",
      "departmentId",
      "designationId",
    ];
    const data: Record<string, unknown> = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.includes(k))
    );

    // Normalize the couple of typed fields the client may send.
    if ("gender" in body && ["MALE", "FEMALE", "UNISEX"].includes(body.gender)) {
      data.gender = body.gender;
    }
    if ("dateOfBirth" in body) {
      data.dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    }

    if (Object.keys(data).length === 0) {
      return err("No valid fields to update", 422);
    }

    const worker = await prisma.workerProfile.update({ where: { id }, data });
    return ok(worker, "Worker updated");
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2025") return err("Worker not found", 404);
    if (code === "P2002") return err("Email or phone already in use", 409);
    if (code === "P2003") return err("Invalid departmentId or designationId", 422);
    return err("Internal server error", 500);
  }
}

// DELETE /api/v1/admin/workers/[id] — Deactivate worker (soft delete)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;

    // Soft delete — workers are referenced by appointments/attendance/payroll,
    // so deactivate the profile and its login account instead of hard-deleting.
    const worker = await prisma.workerProfile.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!worker) return err("Worker not found", 404);

    await prisma.$transaction([
      prisma.workerProfile.update({
        where: { id },
        data: { isActive: false, isPublic: false },
      }),
      prisma.user.update({
        where: { id: worker.userId },
        data: { isActive: false },
      }),
    ]);

    return ok(null, "Worker deactivated");
  } catch {
    return err("Internal server error", 500);
  }
}
