import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Worker Leaves
// GET /api/v1/worker/leaves/[id] — View own leave request by ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const { id } = await params;
    // TODO: fetch leave request by id for current worker from prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}

// DELETE /api/v1/worker/leaves/[id] — Cancel own leave request
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "WORKER");
  if (error) return error;

  try {
    const { id } = await params;
    // TODO: cancel leave request in prisma (only if pending)
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
