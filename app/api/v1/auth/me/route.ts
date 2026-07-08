import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Auth — Me
// GET /api/v1/auth/me — Return current authenticated user profile
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  try {
    // TODO: fetch full user profile from prisma using user.id
    return ok(user);
  } catch {
    return err("Internal server error", 500);
  }
}
