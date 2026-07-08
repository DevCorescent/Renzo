import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Auth — OTP Verify
// POST /api/v1/auth/otp/verify — Verify OTP for phone or email
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // body: { phone?: string, email?: string, otp: string, purpose: string }
    // TODO: validate body, verify OTP, complete auth flow
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
