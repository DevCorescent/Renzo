import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Customer Gift Cards

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;

  try {
    const { page, limit, skip } = parsePagination(new URL(req.url));
    // TODO: get gift cards owned by this customer with balance and redemption history
    return paginated([], 0, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;

  try {
    const body = await req.json();
    // TODO: body: { value, recipientName?, recipientPhone?, giftMessage?, expiresAt? }
    // 1. Create Razorpay order for value amount
    // 2. On webhook success: create GiftCard with unique code, type=DIGITAL
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
