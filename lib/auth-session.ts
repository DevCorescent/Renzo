import type { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  signAuthToken,
  authCookieOptions,
  TOKEN_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/jwt";
import { toAuthUser, type UserWithProfiles } from "@/lib/auth-user";

// OWNER: Shalmon | MODULE: Auth — Session issuing
// Signs a JWT, records a Session row (for audit + logout revocation), stamps
// lastLoginAt, and attaches the auth cookie to the given response.
export async function issueSession(
  req: NextRequest,
  res: NextResponse,
  user: UserWithProfiles
): Promise<NextResponse> {
  const token = await signAuthToken(toAuthUser(user));

  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE * 1000),
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  res.cookies.set(TOKEN_COOKIE, token, authCookieOptions());
  return res;
}
