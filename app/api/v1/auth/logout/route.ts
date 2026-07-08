import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Auth — Logout
// POST /api/v1/auth/logout — Clear session cookie and invalidate token
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  try {
    // TODO: invalidate session/token, clear cookie
    return ok({ message: "Logged out successfully" });
  } catch {
    return err("Internal server error", 500);
  }
}
