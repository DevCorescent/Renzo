import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { USER_INCLUDE, toPublicUser } from "@/lib/auth-user";

// OWNER: Shalmon | MODULE: Auth — Me
// GET /api/v1/auth/me — Return the current authenticated user's profile.
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  try {
    const record = await prisma.user.findUnique({
      where: { id: user.userId },
      include: USER_INCLUDE,
    });

    if (!record || !record.isActive) {
      return err("Account not found or disabled", 401);
    }

    return ok({ user: toPublicUser(record) });
  } catch {
    return err("Internal server error", 500);
  }
}
