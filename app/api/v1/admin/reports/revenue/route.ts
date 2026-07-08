import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Revenue Report

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "ACCOUNTANT");
  if (error) return error;

  try {
    const url = new URL(req.url);
    // TODO: query params: branchId?, from (YYYY-MM-DD), to (YYYY-MM-DD), groupBy (day|week|month)
    // Sum invoices.totalAmount grouped by date range
    return ok({ labels: [], values: [], total: 0 });
  } catch {
    return err("Internal server error", 500);
  }
}
