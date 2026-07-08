import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Worker Appointments
// GET /api/v1/worker/appointments/[id] — Single appointment detail for worker
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const { id } = await params;
    // TODO: fetch appointment by id for current worker from prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
