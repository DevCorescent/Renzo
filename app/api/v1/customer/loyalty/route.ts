import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Customer Loyalty Account

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;

  try {
    // TODO: get loyalty account: tier, totalPoints, availablePoints, transactions (last 20)
    return ok(null);
  } catch {
    return err("Internal server error", 500);
  }
}
