import { SignJWT } from "jose";
import type { AuthUser } from "@/types/api";

// OWNER: Shalmon | MODULE: Auth — JWT + session cookie helpers
// Single source of truth for the signing secret + cookie name.
// auth-guard.ts and middleware.ts both import from here.

export const TOKEN_COOKIE = "renzo_token";

// 7 days, in seconds — used for both the JWT `exp` and the cookie `maxAge`.
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "changeme-set-JWT_SECRET-in-env"
);

// Sign a JWT carrying the session claims (userId, userType, scoped ids).
export async function signAuthToken(user: AuthUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setJti(crypto.randomUUID()) // unique per token → no Session.token collisions
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(JWT_SECRET);
}

// Cookie options shared by login / otp-verify (set) and logout (clear).
export function authCookieOptions(maxAge: number = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
