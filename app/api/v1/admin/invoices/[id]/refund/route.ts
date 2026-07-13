import { NextRequest } from "next/server";
import { created, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import type { PaymentMethod } from "@prisma/client";

const METHODS: PaymentMethod[] = [
  "CASH", "UPI", "CARD", "ONLINE", "WALLET", "GIFT_CARD", "LOYALTY_POINTS", "MEMBERSHIP",
];

// OWNER: Shalmon | MODULE: Refunds
// POST /api/v1/admin/invoices/[id]/refund — Issue a refund and adjust the invoice
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const amount = Number(body.amount);
    const reason: string = typeof body.reason === "string" ? body.reason.trim() : "";
    const method: PaymentMethod = METHODS.includes(body.method) ? body.method : "CASH";

    const errors: Record<string, string[]> = {};
    if (!Number.isFinite(amount) || amount <= 0) errors.amount = ["Amount must be a positive number"];
    if (!reason) errors.reason = ["Reason is required"];
    if (Object.keys(errors).length) return err("Validation failed", 422, errors);

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return err("Invoice not found", 404);
    if (amount > invoice.paidAmount) {
      return err("Refund exceeds the paid amount", 422, {
        amount: [`Cannot refund more than paid (${invoice.paidAmount})`],
      });
    }

    // Adjust the invoice + record the refund atomically.
    const result = await prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          invoiceId: id,
          paymentId: typeof body.paymentId === "string" ? body.paymentId : null,
          amount,
          reason,
          method,
          processedBy: user.userId,
          notes: typeof body.notes === "string" ? body.notes : null,
        },
      });

      const paidAmount = invoice.paidAmount - amount;
      const balanceDue = invoice.totalAmount - paidAmount;
      const status = paidAmount <= 0 ? "REFUNDED" : "PARTIAL";

      const updated = await tx.invoice.update({
        where: { id },
        data: { paidAmount, balanceDue, status },
      });

      return { refund, invoice: updated };
    });

    return created(result, "Refund issued");
  } catch {
    return err("Internal server error", 500);
  }
}
