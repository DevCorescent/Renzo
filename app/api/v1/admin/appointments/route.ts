import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Appointments
// GET /api/v1/admin/appointments — List all appointments paginated with filters
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { page, limit, skip, search } = parsePagination(new URL(req.url));
    // TODO: fetch appointments with filters (status, date, branchId, workerId) from prisma
    return paginated([], 0, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/appointments — Create appointment manually
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const body = await req.json();
    // TODO: validate body, create appointment in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
