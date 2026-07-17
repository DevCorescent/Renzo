import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import type { AuthUser } from "@/types/api";
import { CUSTOMER_LOGIN_PATH, STAFF_LOGIN_PATH } from "@/lib/auth-paths";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "changeme-set-JWT_SECRET-in-env"
);

const ROUTE_ROLES: Array<{
  prefix: string;
  roles: AuthUser["userType"][];
  loginPath: string;
}> = [
  { prefix: "/super-admin", roles: ["SUPER_ADMIN", "OWNER"], loginPath: STAFF_LOGIN_PATH },
  { prefix: "/branch-admin", roles: ["BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"], loginPath: STAFF_LOGIN_PATH },
  {
    prefix: "/reception",
    roles: ["RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"],
    loginPath: STAFF_LOGIN_PATH,
  },
  { prefix: "/worker", roles: ["WORKER"], loginPath: STAFF_LOGIN_PATH },
  { prefix: "/customer", roles: ["CUSTOMER"], loginPath: CUSTOMER_LOGIN_PATH },
  { prefix: "/inventory", roles: ["INVENTORY_MANAGER", "SUPER_ADMIN", "OWNER"], loginPath: STAFF_LOGIN_PATH },
  { prefix: "/marketing", roles: ["MARKETING_MANAGER", "SUPER_ADMIN", "OWNER"], loginPath: STAFF_LOGIN_PATH },
  { prefix: "/accountant", roles: ["ACCOUNTANT", "SUPER_ADMIN", "OWNER"], loginPath: STAFF_LOGIN_PATH },
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const rule = ROUTE_ROLES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  const token = req.cookies.get("renzo_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL(rule.loginPath, req.url));
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const user = payload as unknown as AuthUser;
    if (!rule.roles.includes(user.userType)) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL(rule.loginPath, req.url));
  }
}

export const config = {
  matcher: [
    "/super-admin/:path*",
    "/branch-admin/:path*",
    "/reception/:path*",
    "/worker/:path*",
    "/customer/:path*",
    "/inventory/:path*",
    "/marketing/:path*",
    "/accountant/:path*",
  ],
};
