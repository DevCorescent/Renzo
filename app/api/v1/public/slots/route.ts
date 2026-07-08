import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Slot Availability
// GET /api/v1/public/slots — Get available slots for branch+service+worker+date (no auth)
// Query params: branchId, serviceId, workerId? (optional), date (YYYY-MM-DD)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const branchId = url.searchParams.get("branchId");
    const serviceId = url.searchParams.get("serviceId");
    const workerId = url.searchParams.get("workerId");
    const date = url.searchParams.get("date");
    // TODO: validate query params, compute available time slots from prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
