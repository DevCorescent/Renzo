import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Customer Wallet Top-up

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;

  try {
    const body = await req.json();
    // TODO: body: { amount: number }
    // 1. Create Razorpay order for amount
    // 2. Return orderId to frontend for payment
    // 3. On webhook success: credit wallet, create WalletTransaction CREDIT
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
