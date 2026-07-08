import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Reception Assign Worker
// PATCH /api/v1/reception/appointments/[id]/assign — Reassign worker for appointment
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    // TODO: validate body, reassign worker in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
