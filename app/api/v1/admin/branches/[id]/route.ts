import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Aman | MODULE: Branch Management
// GET /api/v1/admin/branches/[id] — Get branch by ID
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const branch = await prisma.branch.findUnique({
      where: { id },
      include: { timings: true, setting: true },
    });
    if (!branch) return err("Branch not found", 404);
    return ok(branch);
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/branches/[id] — Update branch details
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();

    // Only allow known, editable columns — ignore anything else the client sends.
    const allowed = [
      "name",
      "slug",
      "code",
      "address",
      "city",
      "state",
      "pincode",
      "country",
      "lat",
      "lng",
      "phone",
      "email",
      "whatsapp",
      "mapUrl",
      "coverImage",
      "description",
      "isActive",
      "isPublic",
      "sortOrder",
    ];
    const data = Object.fromEntries(
      Object.entries(body).filter(([k]) => allowed.includes(k))
    );
    if (Object.keys(data).length === 0) {
      return err("No valid fields to update", 422);
    }

    const branch = await prisma.branch.update({ where: { id }, data });
    return ok(branch, "Branch updated");
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "P2025") return err("Branch not found", 404);
    if (code === "P2002") {
      return err("A branch with that slug or code already exists", 409);
    }
    return err("Internal server error", 500);
  }
}

// DELETE /api/v1/admin/branches/[id] — Soft-delete a branch
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    // Soft delete — branches have appointments/invoices/stock linked, so we
    // deactivate instead of hard-deleting to preserve referential integrity.
    await prisma.branch.update({
      where: { id },
      data: { isActive: false, isPublic: false },
    });
    return ok(null, "Branch deactivated");
  } catch (e: unknown) {
    if ((e as { code?: string })?.code === "P2025") {
      return err("Branch not found", 404);
    }
    return err("Internal server error", 500);
  }
}
