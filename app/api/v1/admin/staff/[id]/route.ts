import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Staff Management — Single staff member

// ─── GET /api/v1/admin/staff/[id] ────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const staff = await prisma.staffProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            userType: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        branch: { select: { id: true, name: true, code: true, city: true } },
      },
    });

    if (!staff) return err("Staff member not found", 404);
    return ok(staff);
  } catch {
    return err("Internal server error", 500);
  }
}

// ─── PATCH /api/v1/admin/staff/[id] ──────────────────────────────────────────
// Update profile fields + optionally move to a different branch or toggle active.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const staff = await prisma.staffProfile.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!staff) return err("Staff member not found", 404);

    // Fields allowed on StaffProfile itself.
    const profileAllowed = ["firstName", "lastName", "phone", "email", "profilePhoto"];
    const profileData: Record<string, unknown> = Object.fromEntries(
      Object.entries(body).filter(([k]) => profileAllowed.includes(k))
    );
    if ("branchId" in body) profileData.branchId = body.branchId ?? null;

    // User-level fields.
    const userAllowed = ["isActive"];
    const userData: Record<string, unknown> = Object.fromEntries(
      Object.entries(body).filter(([k]) => userAllowed.includes(k))
    );

    if (Object.keys(profileData).length === 0 && Object.keys(userData).length === 0) {
      return err("No valid fields to update", 422);
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(profileData).length) {
        await tx.staffProfile.update({ where: { id }, data: profileData });
      }
      if (Object.keys(userData).length) {
        await tx.user.update({ where: { id: staff.userId }, data: userData });
      }
    });

    const updated = await prisma.staffProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, phone: true, userType: true, isActive: true },
        },
        branch: { select: { id: true, name: true } },
      },
    });

    return ok(updated, "Staff member updated");
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2003") return err("Invalid branchId", 422);
    if (code === "P2002") return err("Email or phone already in use", 409);
    return err("Internal server error", 500);
  }
}

// ─── DELETE /api/v1/admin/staff/[id] ─────────────────────────────────────────
// Soft-deactivate — preserves audit trail.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const staff = await prisma.staffProfile.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!staff) return err("Staff member not found", 404);

    await prisma.$transaction([
      prisma.staffProfile.update({ where: { id }, data: { isActive: false } }),
      prisma.user.update({ where: { id: staff.userId }, data: { isActive: false } }),
      // Revoke all active sessions so they're immediately logged out.
      prisma.session.deleteMany({ where: { userId: staff.userId } }),
    ]);

    return ok(null, "Staff member deactivated");
  } catch {
    return err("Internal server error", 500);
  }
}
