import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Campaigns

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const { page, limit, skip } = parsePagination(new URL(req.url));
    // TODO: list campaigns with sent/open counts
    return paginated([], 0, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const body = await req.json();
    // TODO: create campaign — body: { name, channel, templateId, targetSegment, scheduledAt? }
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
