import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Customer Appointments
// GET /api/v1/customer/appointments/[id] — Get single appointment detail
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;

  try {
    const { id } = await params;
    // TODO: fetch appointment by id for current customer from prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
