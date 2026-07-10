import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { hashPassword } from "@/lib/password";
import prisma from "@/lib/db";

// One-time setup endpoint — creates the first Super Admin if none exists.
// Hit POST /api/v1/setup/seed once after first deploy, then you can disable it.

export async function POST(_req: NextRequest) {
  try {
    const existing = await prisma.user.findFirst({
      where: { userType: "SUPER_ADMIN" },
    });

    if (existing) {
      return err("Super Admin already exists. Use login instead.", 409);
    }

    const passwordHash = await hashPassword("Renzo@2026");

    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email: "superadmin@renzo.com",
          passwordHash,
          userType: "SUPER_ADMIN",
          isActive: true,
          isVerified: true,
        },
      });
      await tx.staffProfile.create({
        data: {
          userId: u.id,
          firstName: "Super",
          lastName: "Admin",
          email: "superadmin@renzo.com",
        },
      });
      return u;
    });

    return ok(
      { email: user.email, password: "Renzo@2026" },
      "Super Admin created. Save these credentials and disable this endpoint."
    );
  } catch {
    return err("Internal server error", 500);
  }
}
