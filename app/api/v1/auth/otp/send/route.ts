import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Auth — OTP Send
// POST /api/v1/auth/otp/send — Send OTP to phone or email
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // body: { phone?: string, email?: string, purpose: string }
    // TODO: validate body, generate OTP, send via SMS/email
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
