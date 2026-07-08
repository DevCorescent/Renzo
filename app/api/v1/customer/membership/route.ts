import { NextRequest } from "next/server";
import { ok, created, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Customer Membership

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;

  try {
    // TODO: get customer's active membership with plan details and usage logs
    return ok(null);
  } catch {
    return err("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;

  try {
    const body = await req.json();
    // TODO: body: { planId }
    // 1. Check no active membership exists
    // 2. Create invoice for plan price
    // 3. Create CustomerMembership record
    // 4. Credit wallet if plan has walletCredit
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
