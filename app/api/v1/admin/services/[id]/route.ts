import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Services
// GET /api/v1/admin/services/[id] — Get service by ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    // TODO: fetch service by id from prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/services/[id] — Update service
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    // TODO: validate body, update service in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}

// DELETE /api/v1/admin/services/[id] — Delete service
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    // TODO: delete service from prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
