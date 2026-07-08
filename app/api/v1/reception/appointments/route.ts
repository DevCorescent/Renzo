import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Reception Appointments
// GET /api/v1/reception/appointments — Today's appointments for branch
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { page, limit, skip, search } = parsePagination(new URL(req.url));
    // TODO: fetch today's appointments for the receptionist's branch from prisma
    return paginated([], 0, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/reception/appointments — Create walk-in booking
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const body = await req.json();
    // TODO: validate body, create walk-in appointment in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
