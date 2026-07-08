import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Worker Shifts
// GET /api/v1/worker/shifts — Get own current shift
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    // TODO: fetch current shift for authenticated worker from prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
