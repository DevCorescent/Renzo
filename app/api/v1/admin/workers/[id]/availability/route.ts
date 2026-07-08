import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Worker Availability
// GET /api/v1/admin/workers/[id]/availability — Get worker availability schedule
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    // TODO: fetch worker availability from prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/workers/[id]/availability — Create or update worker availability
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    // TODO: validate body, upsert worker availability in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
