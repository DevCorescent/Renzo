import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Worker Attendance
// GET /api/v1/worker/attendance — Get own attendance log
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const { page, limit, skip, search } = parsePagination(new URL(req.url));
    // TODO: fetch attendance log for current worker from prisma
    return paginated([], 0, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/worker/attendance — Clock in/out or break action
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const body = await req.json();
    // body: { action: "CHECK_IN" | "CHECK_OUT" | "BREAK_START" | "BREAK_END" }
    // TODO: validate body, record attendance action in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
