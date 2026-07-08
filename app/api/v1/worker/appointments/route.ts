import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Worker Appointments
// GET /api/v1/worker/appointments — Own today's and upcoming appointments
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const { page, limit, skip, search } = parsePagination(new URL(req.url));
    // TODO: fetch today's and upcoming appointments for current worker from prisma
    return paginated([], 0, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}
