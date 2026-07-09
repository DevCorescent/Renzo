import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";

// OWNER: Shalmon | MODULE: Reception Billing
// GET /api/v1/reception/billing/[id] — POS invoice detail
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        payments: { orderBy: { paidAt: "desc" } },
        refunds: { orderBy: { processedAt: "desc" } },
        appointment: {
          select: {
            appointmentNo: true,
            appointmentDate: true,
            startTime: true,
            status: true,
          },
        },
      },
    });

    if (!invoice) return err("Invoice not found", 404);

    // Branch-scoped roles may only read invoices from their own branch.
    const branchScoped = user.userType === "RECEPTIONIST" || user.userType === "BRANCH_ADMIN";
    if (branchScoped && user.branchId && invoice.branchId !== user.branchId) {
      return err("Forbidden — invoice belongs to another branch", 403);
    }

    return ok(invoice);
  } catch {
    return err("Internal server error", 500);
  }
}
