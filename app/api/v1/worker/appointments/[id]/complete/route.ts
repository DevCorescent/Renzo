import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Worker Service Complete
// POST /api/v1/worker/appointments/[id]/complete — Mark service as completed
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    // body: { serviceNotes?: string, productsUsed?: Array<{ productId: string, quantity: number }> }
    // TODO: validate body, update appointment status to COMPLETED, record notes and products used in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
