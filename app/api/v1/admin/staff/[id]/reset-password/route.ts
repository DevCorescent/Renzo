import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { hashPassword } from "@/lib/password";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Staff Management — Reset password
// POST /api/v1/admin/staff/[id]/reset-password
// Allows Super Admin / Owner to set a new password for any staff member.
// Body: { password: string }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    if (!body.password || typeof body.password !== "string" || body.password.length < 6) {
      return err("Password must be at least 6 characters", 422);
    }

    const staff = await prisma.staffProfile.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!staff) return err("Staff member not found", 404);

    const passwordHash = await hashPassword(body.password as string);

    await prisma.$transaction([
      prisma.user.update({ where: { id: staff.userId }, data: { passwordHash } }),
      // Revoke existing sessions — they must login again with the new password.
      prisma.session.deleteMany({ where: { userId: staff.userId } }),
    ]);

    return ok(null, "Password reset successfully");
  } catch {
    return err("Internal server error", 500);
  }
}
