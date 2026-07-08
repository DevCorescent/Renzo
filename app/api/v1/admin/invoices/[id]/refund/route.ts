import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Refunds
// POST /api/v1/admin/invoices/[id]/refund — Issue a refund for an invoice
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    // body: { amount: number, reason: string, method: PaymentMethod }
    // TODO: validate body, create refund record and update invoice in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
