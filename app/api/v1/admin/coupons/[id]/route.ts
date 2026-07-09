import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Coupons
// GET /api/v1/admin/coupons/[id] — Coupon detail with usage history
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: { usages: { orderBy: { usedAt: "desc" }, take: 50 } },
    });
    if (!coupon) return err("Coupon not found", 404);
    return ok(coupon);
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/coupons/[id] — Update a coupon
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) return err("Coupon not found", 404);

    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...(typeof body.description === "string" ? { description: body.description } : {}),
        ...(body.value != null ? { value: Number(body.value) } : {}),
        ...(body.minOrderAmount != null ? { minOrderAmount: Number(body.minOrderAmount) } : {}),
        ...(body.maxDiscount != null ? { maxDiscount: Number(body.maxDiscount) } : {}),
        ...(body.usageLimit != null ? { usageLimit: Number(body.usageLimit) } : {}),
        ...(body.validUntil ? { validUntil: new Date(body.validUntil) } : {}),
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      },
    });
    return ok(coupon, "Coupon updated");
  } catch {
    return err("Internal server error", 500);
  }
}

// DELETE /api/v1/admin/coupons/[id] — Soft-delete (deactivate)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const existing = await prisma.coupon.findUnique({ where: { id } });
    if (!existing) return err("Coupon not found", 404);
    await prisma.coupon.update({ where: { id }, data: { isActive: false } });
    return ok(null, "Coupon deactivated");
  } catch {
    return err("Internal server error", 500);
  }
}
