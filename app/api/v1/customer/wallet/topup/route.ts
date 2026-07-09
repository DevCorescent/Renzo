import { NextRequest } from "next/server";
import { created, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { creditWallet } from "@/lib/wallet";

// OWNER: Shalmon | MODULE: Customer Wallet Top-up
// POST /api/v1/customer/wallet/topup — Body: { amount }
//
// Real flow: create a Razorpay order, then credit the wallet only from the
// verified payment webhook. Razorpay isn't wired yet (no RAZORPAY_* env), so
// outside production we credit directly to unblock testing. Production refuses
// rather than handing out free balance.
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;
  if (!user.customerId) return err("Customer profile not found", 403);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return err("Validation failed", 422, { amount: ["amount must be a positive number"] });
    }

    if (process.env.NODE_ENV === "production") {
      return err("Payment gateway not configured — top-up unavailable", 503);
    }

    const wallet = await prisma.$transaction((tx) =>
      creditWallet(tx, user.customerId!, amount, "TOPUP", {
        description: `Wallet top-up of ${amount}`,
      })
    );

    return created(
      { balance: wallet.balance, totalAdded: wallet.totalAdded, credited: amount },
      "Wallet topped up"
    );
  } catch {
    return err("Internal server error", 500);
  }
}
