import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Purchase Orders
// GET /api/v1/admin/inventory/purchases/[id] — Get purchase order by ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    // TODO: fetch purchase order by id from prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/inventory/purchases/[id] — Update purchase order status or receive items
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    // TODO: validate body, update purchase order status or record received items in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
