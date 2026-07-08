import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Reception Check-in
// POST /api/v1/reception/appointments/[id]/checkin — Mark customer as checked in
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    // TODO: update appointment check-in timestamp and status in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
