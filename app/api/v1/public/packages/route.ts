import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Public Packages
// GET /api/v1/public/packages — List active packages (no auth)
export async function GET(req: NextRequest) {
  try {
    const { page, limit, skip, search } = parsePagination(new URL(req.url));
    // TODO: fetch active packages from prisma
    return paginated([], 0, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
