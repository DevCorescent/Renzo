import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Customer Reschedule
// POST /api/v1/customer/appointments/[id]/reschedule — Request appointment reschedule
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    // body: { newDate: string, newTime: string, reason: string }
    // TODO: validate body, create reschedule request in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
