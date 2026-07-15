import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Leave Types (HR configuration)
//
// Detail / edit / delete for a single leave type. Same platform-only RBAC and
// envelopes as the collection route. params is a Promise (Next 16) and is awaited.

// GET /api/v1/admin/leave-types/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const leaveType = await prisma.leaveType.findUnique({ where: { id } });
    if (!leaveType) return err("Leave type not found", 404);
    return ok(leaveType);
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/leave-types/[id] — Edit name / paid / active / maxPerYear.
//
// Code is deliberately NOT editable: it is the stable unique key that Leave rows
// are conceptually filed under, so it is fixed at creation. Every field is applied
// only when present, so a partial patch (e.g. just the active toggle) leaves the
// rest untouched.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const existing = await prisma.leaveType.findUnique({ where: { id } });
    if (!existing) return err("Leave type not found", 404);

    // Name, when sent, must be non-empty — a rename to blank is a mistake, not an
    // instruction. An absent name simply leaves the current one in place.
    let name: string | undefined;
    if (body.name !== undefined) {
      const trimmed = typeof body.name === "string" ? body.name.trim() : "";
      if (!trimmed) return err("Validation failed", 422, { name: ["Name cannot be empty"] });
      name = trimmed;
    }

    const maxPerYear =
      body.maxPerYear != null && Number.isFinite(Number(body.maxPerYear)) && Number(body.maxPerYear) >= 0
        ? Math.floor(Number(body.maxPerYear))
        : undefined;

    const leaveType = await prisma.leaveType.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(typeof body.isPaid === "boolean" ? { isPaid: body.isPaid } : {}),
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
        ...(maxPerYear !== undefined ? { maxPerYear } : {}),
      },
    });

    return ok(leaveType, "Leave type updated");
  } catch {
    return err("Internal server error", 500);
  }
}

// DELETE /api/v1/admin/leave-types/[id] — Reference-guarded hard delete.
//
// A leave type that any Leave or LeaveBalance points at MUST NOT be destroyed —
// doing so would orphan history (and the FK would reject it anyway). So we refuse
// with 409 and tell the caller to deactivate instead, which the Active toggle
// already does. Only a genuinely unused type — typically one created by mistake —
// is actually deleted. This is why the UI keeps deactivation as the primary action
// and treats delete as the exception.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const existing = await prisma.leaveType.findUnique({ where: { id } });
    if (!existing) return err("Leave type not found", 404);

    const [leaveCount, balanceCount] = await Promise.all([
      prisma.leave.count({ where: { leaveTypeId: id } }),
      prisma.leaveBalance.count({ where: { leaveTypeId: id } }),
    ]);

    if (leaveCount > 0 || balanceCount > 0) {
      return err(
        "This leave type is already in use. Please deactivate it instead.",
        409
      );
    }

    await prisma.leaveType.delete({ where: { id } });
    return ok(null, "Leave type deleted");
  } catch (e: unknown) {
    // Belt and braces: if a reference slipped in between the count and the delete,
    // Prisma raises P2003 (FK violation) — surface the same guidance, not a 500.
    if ((e as { code?: string })?.code === "P2003") {
      return err(
        "This leave type is already in use. Please deactivate it instead.",
        409
      );
    }
    return err("Internal server error", 500);
  }
}
