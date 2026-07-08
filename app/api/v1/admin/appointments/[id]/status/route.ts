import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Appointment Status
// PATCH /api/v1/admin/appointments/[id]/status — Update appointment status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN", "RECEPTIONIST");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    // body: { status: AppointmentStatus }
    // TODO: validate body, update appointment status in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
