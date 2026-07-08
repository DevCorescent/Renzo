import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Worker Portfolio
// GET /api/v1/worker/portfolio — Get own portfolio items
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const { page, limit, skip, search } = parsePagination(new URL(req.url));
    // TODO: fetch portfolio items for current worker from prisma
    return paginated([], 0, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/worker/portfolio — Upload a new portfolio item
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const body = await req.json();
    // TODO: validate body, create portfolio item (pending approval) in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
