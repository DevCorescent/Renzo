import { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { err } from "@/lib/response";
import type { AuthUser, UserType } from "@/types/api";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "changeme-set-JWT_SECRET-in-env"
);

export const TOKEN_COOKIE = "renzo_token";

export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  try {
    const token =
      req.cookies.get(TOKEN_COOKIE)?.value ??
      req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return null;
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as AuthUser;
  } catch {
    return null;
  }
}

// Use inside every protected route handler:
//   const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
//   if (error) return error;
export async function requireAuth(
  req: NextRequest,
  ...roles: UserType[]
): Promise<{ user: AuthUser; error: null } | { user: null; error: ReturnType<typeof err> }> {
  const user = await getAuthUser(req);
  if (!user) return { user: null, error: err("Unauthorized", 401) };
  if (roles.length > 0 && !roles.includes(user.userType)) {
    return { user: null, error: err("Forbidden — insufficient role", 403) };
  }
  return { user, error: null };
}
