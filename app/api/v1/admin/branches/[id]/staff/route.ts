import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Branch Management — Staff listing for a branch
// GET /api/v1/admin/branches/[id]/staff
// Returns all staff profiles tied to this branch (admins, receptionists, etc.)

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

    // Branch admins can only view their own branch staff.
    if (user.userType === "BRANCH_ADMIN" && user.branchId !== id) {
      return err("Forbidden", 403);
    }

    const branch = await prisma.branch.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!branch) return err("Branch not found", 404);

    const staff = await prisma.staffProfile.findMany({
      where: { branchId: id },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            userType: true,
            isActive: true,
            lastLoginAt: true,
          },
        },
      },
    });

    return ok(staff);
  } catch {
    return err("Internal server error", 500);
  }
}
