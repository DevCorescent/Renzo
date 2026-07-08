import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Public Workers
// GET /api/v1/public/workers — List public worker profiles (no auth)
export async function GET(req: NextRequest) {
  try {
    const { page, limit, skip, search } = parsePagination(new URL(req.url));
    // TODO: fetch public worker profiles from prisma
    return paginated([], 0, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
