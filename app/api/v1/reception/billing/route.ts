import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Reception Billing
// POST /api/v1/reception/billing — Generate invoice from appointment
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const body = await req.json();
    // body: { appointmentId: string }
    // TODO: validate body, generate invoice from appointment in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
