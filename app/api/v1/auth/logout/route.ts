import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import prisma from "@/lib/db";
import { TOKEN_COOKIE, authCookieOptions } from "@/lib/jwt";

// OWNER: Shalmon | MODULE: Auth — Logout
// POST /api/v1/auth/logout — Revoke the current session row and clear the
// cookie. Idempotent: succeeds even without a valid session.
export async function POST(req: NextRequest) {
  try {
    const token =
      req.cookies.get(TOKEN_COOKIE)?.value ??
      req.headers.get("authorization")?.replace("Bearer ", "");

    if (token) {
      await prisma.session.deleteMany({ where: { token } });
    }

    const res = ok(null, "Logged out successfully");
    // Expire the cookie immediately.
    res.cookies.set(TOKEN_COOKIE, "", authCookieOptions(0));
    return res;
  } catch {
    return err("Internal server error", 500);
  }
}
