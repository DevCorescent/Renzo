import { NextRequest } from "next/server";
import { ok, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Customer Wallet

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;

  try {
    const { page, limit, skip } = parsePagination(new URL(req.url));
    // TODO: get wallet balance + paginated transactions
    return ok({ balance: 0, transactions: [] });
  } catch {
    return err("Internal server error", 500);
  }
}
