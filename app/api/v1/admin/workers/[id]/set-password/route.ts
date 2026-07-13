import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { hashPassword } from "@/lib/password";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Worker Management — Set / reset password
// POST /api/v1/admin/workers/[id]/set-password
// Body: { password: string }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    if (!body.password || typeof body.password !== "string" || body.password.length < 6) {
      return err("Password must be at least 6 characters", 422);
    }

    const worker = await prisma.workerProfile.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!worker) return err("Worker not found", 404);

    const passwordHash = await hashPassword(body.password as string);

    await prisma.$transaction([
      prisma.user.update({ where: { id: worker.userId }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { userId: worker.userId } }),
    ]);

    return ok(null, "Password set successfully");
  } catch {
    return err("Internal server error", 500);
  }
}
