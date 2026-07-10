import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Staff Management — Single staff member
//
// SUPER_ADMIN   → full access to any staff record
// OWNER / BRANCH_ADMIN → only their own branch's staff

// ─── GET /api/v1/admin/staff/[id] ────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN"
  );
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

    // Branch-scoped roles can only view staff from their own branch.
    if (
      (user.userType === "OWNER" || user.userType === "BRANCH_ADMIN") &&
      staff.branchId !== user.branchId
    ) {
      return err("Forbidden", 403);
    }

    return ok(staff);
  } catch {
    return err("Internal server error", 500);
  }
}

// ─── PATCH /api/v1/admin/staff/[id] ──────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN"
  );
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const staff = await prisma.staffProfile.findUnique({
      where: { id },
      select: { userId: true, branchId: true },
    });
    if (!staff) return err("Staff member not found", 404);

    // Branch admins / owners can only update staff in their own branch.
    if (
      (user.userType === "OWNER" || user.userType === "BRANCH_ADMIN") &&
      staff.branchId !== user.branchId
    ) {
      return err("Forbidden", 403);
    }

    const profileAllowed = ["firstName", "lastName", "phone", "email", "profilePhoto"];
    const profileData: Record<string, unknown> = Object.fromEntries(
      Object.entries(body).filter(([k]) => profileAllowed.includes(k))
    );

    // Only Super Admin can reassign someone to a different branch.
    if (user.userType === "SUPER_ADMIN" && "branchId" in body) {
      profileData.branchId = body.branchId ?? null;
    }

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
// Soft-deactivate — preserves audit trail, revokes sessions immediately.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth(
    req,
    "SUPER_ADMIN",
    "OWNER",
    "BRANCH_ADMIN"
  );
  if (error) return error;

  try {
    const { id } = await params;
    const staff = await prisma.staffProfile.findUnique({
      where: { id },
      select: { userId: true, branchId: true },
    });
    if (!staff) return err("Staff member not found", 404);

    // Branch admins / owners can only deactivate staff in their own branch.
    if (
      (user.userType === "OWNER" || user.userType === "BRANCH_ADMIN") &&
      staff.branchId !== user.branchId
    ) {
      return err("Forbidden", 403);
    }

    await prisma.$transaction([
      prisma.staffProfile.update({ where: { id }, data: { isActive: false } }),
      prisma.user.update({ where: { id: staff.userId }, data: { isActive: false } }),
      prisma.session.deleteMany({ where: { userId: staff.userId } }),
    ]);

    return ok(null, "Staff member deactivated");
  } catch {
    return err("Internal server error", 500);
  }
}
