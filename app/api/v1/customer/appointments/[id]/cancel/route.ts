import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Customer Cancel
// POST /api/v1/customer/appointments/[id]/cancel — Cancel appointment
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    // body: { reason: string }
    // TODO: validate body, cancel appointment in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
