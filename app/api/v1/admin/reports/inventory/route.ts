import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Inventory Report

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "INVENTORY_MANAGER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const url = new URL(req.url);
    // TODO: query params: branchId?, from, to
    // Stock usage by product, low stock items, purchase totals, wastage
    return ok({ usage: [], lowStock: [], purchaseTotal: 0 });
  } catch {
    return err("Internal server error", 500);
  }
}
