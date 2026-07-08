import { NextRequest } from "next/server";
import { ok, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Worker Performance Report

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { page, limit, skip } = parsePagination(new URL(req.url));
    const url = new URL(req.url);
    // TODO: query params: branchId?, from, to
    // Per worker: totalRevenue, totalAppointments, completionRate, avgRating
    return paginated([], 0, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
