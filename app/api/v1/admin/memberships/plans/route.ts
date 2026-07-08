import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Membership Plans

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { page, limit, skip } = parsePagination(new URL(req.url));
    // TODO: list membership plans with benefits
    return paginated([], 0, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const body = await req.json();
    // TODO: create plan — body: { name, tier, price, validityDays, discountPercent, walletCredit, benefits[] }
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
