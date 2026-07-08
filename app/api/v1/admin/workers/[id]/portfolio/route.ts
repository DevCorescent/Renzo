import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Worker Portfolio Approval
// GET /api/v1/admin/workers/[id]/portfolio — List portfolio items for a worker
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const { page, limit, skip, search } = parsePagination(new URL(req.url));
    // TODO: fetch portfolio items for worker from prisma
    return paginated([], 0, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/workers/[id]/portfolio — Approve or reject a portfolio item
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    // body: { portfolioId: string, approve: boolean }
    // TODO: validate body, update portfolio item approval status in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
