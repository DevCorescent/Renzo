import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Branch Timings
// GET /api/v1/admin/branches/[id]/timings — Get all 7-day timings for a branch
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    // TODO: fetch all 7 day timings for the branch from prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}

// PUT /api/v1/admin/branches/[id]/timings — Bulk update all 7 day timings
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    // TODO: validate body (array of 7 day timing objects), upsert timings in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
