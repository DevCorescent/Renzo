import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Appointment Assign
// PATCH /api/v1/admin/appointments/[id]/assign — Assign worker to appointment
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN", "RECEPTIONIST");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    // body: { workerId: string }
    // TODO: validate body, assign worker to appointment in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
