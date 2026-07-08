import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import prisma from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { USER_INCLUDE, toPublicUser } from "@/lib/auth-user";
import { issueSession } from "@/lib/auth-session";

// OWNER: Shalmon | MODULE: Auth — Login
// POST /api/v1/auth/login — Authenticate a staff/admin/customer with
// email-or-phone + password. Issues a JWT session cookie on success.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return err("Invalid JSON body", 400);
    }

    const identifier: string = (body.email ?? body.phone ?? "").trim();
    const password: string = body.password ?? "";

    const errors: Record<string, string[]> = {};
    if (!identifier) errors.identifier = ["Email or phone is required"];
    if (!password) errors.password = ["Password is required"];
    if (Object.keys(errors).length) {
      return err("Validation failed", 422, errors);
    }

    const isEmail = identifier.includes("@");
    const user = await prisma.user.findFirst({
      where: isEmail
        ? { email: identifier.toLowerCase() }
        : { phone: identifier },
      include: USER_INCLUDE,
    });

    // Same generic message whether the user is missing or the password is
    // wrong — do not leak which accounts exist.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return err("Invalid credentials", 401);
    }

    if (!user.isActive) {
      return err("Account is disabled", 403);
    }

    const res = ok(
      { user: toPublicUser(user) },
      "Logged in successfully"
    );
    return await issueSession(req, res, user);
  } catch {
    return err("Internal server error", 500);
  }
}
