import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Worker Management
// GET /api/v1/admin/workers — List all workers paginated
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { page, limit, skip, search } = parsePagination(new URL(req.url));
    // TODO: fetch workers list with pagination and search
    return paginated([], 0, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/workers — Create worker profile + user account
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const body = await req.json();
    // TODO: validate body, create user and worker profile in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
