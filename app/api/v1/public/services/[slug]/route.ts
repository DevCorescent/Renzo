import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Public Services
// GET /api/v1/public/services/[slug] — Get single service detail by slug (no auth)
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    // TODO: fetch active service by slug from prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
