import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Public Workers
// GET /api/v1/public/workers/[id] — Get single worker public profile (no auth)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // TODO: fetch public worker profile by id from prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
