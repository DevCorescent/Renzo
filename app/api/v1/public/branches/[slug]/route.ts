import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Public Branches
// GET /api/v1/public/branches/[slug] — Get single branch details by slug (no auth)
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    // TODO: fetch active branch by slug from prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
