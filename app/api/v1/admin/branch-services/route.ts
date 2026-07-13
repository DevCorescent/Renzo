import { NextRequest } from "next/server";
import { ok, err, created } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Gauransh | MODULE: Branch Service Pricing
// GET  /api/v1/admin/branch-services?branchId=X  — all services with branch pricing
// POST /api/v1/admin/branch-services             — upsert branch pricing for one service

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const url = new URL(req.url);
  const branchId = url.searchParams.get("branchId")?.trim() ?? user.branchId;

  if (!branchId) return err("branchId is required");

  // BRANCH_ADMIN / OWNER can only view their own branch
  if (user.userType !== "SUPER_ADMIN" && user.branchId && user.branchId !== branchId) {
    return err("Forbidden", 403);
  }

  try {
    const services = await prisma.service.findMany({
      where: { isActive: true, category: { isActive: true } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        image: true,
        description: true,
        basePrice: true,
        duration: true,
        gender: true,
        category: { select: { id: true, name: true } },
        branchPricings: {
          where: { branchId },
          select: { id: true, price: true, isActive: true },
        },
      },
    });

    const result = services.map((s) => ({
      ...s,
      branchPricing: s.branchPricings[0] ?? null,
    }));

    return ok(result);
  } catch {
    return err("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid request body");

    const { serviceId, branchId: bodyBranchId, price, isActive } = body;
    const branchId: string = bodyBranchId ?? user.branchId;

    if (!serviceId || typeof serviceId !== "string") return err("serviceId is required");
    if (!branchId) return err("branchId is required");
    if (typeof price !== "number" || price < 0) return err("price must be a non-negative number");

    // Scope check
    if (user.userType !== "SUPER_ADMIN" && user.branchId && user.branchId !== branchId) {
      return err("Forbidden", 403);
    }

    const pricing = await prisma.serviceBranchPricing.upsert({
      where: { serviceId_branchId: { serviceId, branchId } },
      create: { serviceId, branchId, price, isActive: isActive !== false },
      update: { price, isActive: isActive !== false },
    });

    return created(pricing, "Branch service pricing updated");
  } catch {
    return err("Internal server error", 500);
  }
}
