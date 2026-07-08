import { NextRequest } from "next/server";
import { ok, created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Reception Payment
// POST /api/v1/reception/billing/[id]/payment — Record payment against invoice
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json();
    // body: { method: PaymentMethod, amount: number, reference?: string }
    // TODO: validate body, record payment against invoice in prisma
    return err("Not implemented", 501);
  } catch {
    return err("Internal server error", 500);
  }
}
