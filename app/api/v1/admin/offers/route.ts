import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Offers

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { page, limit, skip } = parsePagination(new URL(req.url));
    // TODO: list offers; filter by branchId, type, isActive
    return paginated([], 0, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const body = await req.json();
    // TODO: create offer — body: { title, type, discountPercent?, discountAmount?, validFrom, validUntil, branchId? }
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
