import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import type { AuthUser } from "@/types/api";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "changeme-set-JWT_SECRET-in-env"
);

const ROUTE_ROLES: Array<{ prefix: string; roles: AuthUser["userType"][] }> = [
  { prefix: "/super-admin", roles: ["SUPER_ADMIN", "OWNER"] },
  { prefix: "/branch-admin", roles: ["BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"] },
  {
    prefix: "/reception",
    roles: ["RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"],
  },
  { prefix: "/worker",   roles: ["WORKER"] },
  { prefix: "/customer", roles: ["CUSTOMER"] },
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const rule = ROUTE_ROLES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  const token = req.cookies.get("renzo_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const user = payload as unknown as AuthUser;
    if (!rule.roles.includes(user.userType)) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: [
    "/super-admin/:path*",
    "/branch-admin/:path*",
    "/reception/:path*",
    "/worker/:path*",
    "/customer/:path*",
  ],
};
