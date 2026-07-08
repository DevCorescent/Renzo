import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Auth — Login
// POST /api/v1/auth/login — Authenticate user with phone/email + password
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // body: { phone?: string, email?: string, password?: string }
    // TODO: validate body, lookup user, verify password, set session cookie
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
