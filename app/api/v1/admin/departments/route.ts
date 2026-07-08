import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Departments
// GET /api/v1/admin/departments — List all departments paginated
export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { page, limit, skip, search } = parsePagination(new URL(req.url));
    // TODO: fetch departments list from prisma
    return paginated([], 0, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST /api/v1/admin/departments — Create a new department
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const body = await req.json();
    // TODO: validate body, create department in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
