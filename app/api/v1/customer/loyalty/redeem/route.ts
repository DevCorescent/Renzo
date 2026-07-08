import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Customer Loyalty Redeem

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;

  try {
    const body = await req.json();
    // TODO: body: { points: number, invoiceId: string }
    // 1. Check availablePoints >= points
    // 2. Check points <= maxRedemptionPct% of invoice total (from LoyaltyConfig)
    // 3. Deduct points, create LoyaltyTransaction REDEEMED
    // 4. Create Payment record with method=LOYALTY_POINTS
    // 5. Update invoice paidAmount
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
