import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Appointment Stats Report

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    // TODO: query params: branchId?, from, to
    // Count by status: confirmed, completed, cancelled, no-show, rescheduled
    return ok({ confirmed: 0, completed: 0, cancelled: 0, noShow: 0, rescheduled: 0 });
  } catch {
    return err("Internal server error", 500);
  }
}
