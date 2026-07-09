import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Offers
// GET /api/v1/admin/offers/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const offer = await prisma.offer.findUnique({ where: { id } });
    if (!offer) return err("Offer not found", 404);
    return ok(offer);
  } catch {
    return err("Internal server error", 500);
  }
}

// PATCH /api/v1/admin/offers/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const existing = await prisma.offer.findUnique({ where: { id } });
    if (!existing) return err("Offer not found", 404);

    const offer = await prisma.offer.update({
      where: { id },
      data: {
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.description === "string" ? { description: body.description } : {}),
        ...(typeof body.image === "string" ? { image: body.image } : {}),
        ...(body.discountPercent != null ? { discountPercent: Number(body.discountPercent) } : {}),
        ...(body.discountAmount != null ? { discountAmount: Number(body.discountAmount) } : {}),
        ...(body.validUntil ? { validUntil: new Date(body.validUntil) } : {}),
        ...(body.sortOrder != null ? { sortOrder: Number(body.sortOrder) } : {}),
        ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      },
    });
    return ok(offer, "Offer updated");
  } catch {
    return err("Internal server error", 500);
  }
}

// DELETE /api/v1/admin/offers/[id] — Soft-delete (deactivate)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "MARKETING_MANAGER");
  if (error) return error;

  try {
    const { id } = await params;
    const existing = await prisma.offer.findUnique({ where: { id } });
    if (!existing) return err("Offer not found", 404);
    await prisma.offer.update({ where: { id }, data: { isActive: false } });
    return ok(null, "Offer deactivated");
  } catch {
    return err("Internal server error", 500);
  }
}
