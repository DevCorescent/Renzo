import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Worker Service Start
// POST /api/v1/worker/appointments/[id]/start — Mark service as started
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const { id } = await params;
    // TODO: update appointment status to IN_PROGRESS and record start time in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
