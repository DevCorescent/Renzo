import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Customer Reviews
// GET /api/v1/customer/reviews — Get own submitted reviews
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;

  try {
    const { page, limit, skip, search } = parsePagination(new URL(req.url));
    // TODO: fetch reviews submitted by current customer from prisma
    return paginated([], 0, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/customer/reviews — Submit a review
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;

  try {
    const body = await req.json();
    // body: { appointmentId: string, overallRating: number, comment?: string, ... }
    // TODO: validate body, create review record in prisma (status: PENDING)
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
