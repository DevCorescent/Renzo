import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Reviews — Approve

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    // TODO: set review status=APPROVED, isPublic=true, approvedBy=user.userId, approvedAt=now()
    // Then update RatingSummary for worker, branch, service
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
