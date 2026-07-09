import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { computeCouponDiscount, couponUnusableReason } from "@/lib/coupons";
import type { InvoiceStatus } from "@prisma/client";

const EPSILON = 0.01;

// OWNER: Shalmon | MODULE: Coupons — apply to an invoice
// POST /api/v1/reception/billing/[id]/coupon  { code }
// Recomputes the invoice total, records CouponUsage, bumps usedCount.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAuth(req, "RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const code: string = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!code) return err("Validation failed", 422, { code: ["Coupon code is required"] });

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return err("Invoice not found", 404);
    if (invoice.status === "CANCELLED") return err("Cannot discount a cancelled invoice", 409);
    if (invoice.status === "PAID") return err("Invoice is already fully paid", 409);

    // One coupon per invoice.
    const already = await prisma.couponUsage.findFirst({ where: { invoiceId: id } });
    if (already) return err("A coupon has already been applied to this invoice", 409);

    const coupon = await prisma.coupon.findUnique({ where: { code } });
    if (!coupon) return err("Coupon not found", 404);

    // Discount is assessed against the pre-tax subtotal.
    const reason = await couponUnusableReason(prisma, coupon, invoice.customerId, invoice.subtotal);
    if (reason) return err(reason, 422, { code: [reason] });

    const discount = computeCouponDiscount(coupon, invoice.subtotal);
    if (discount <= 0) return err("Coupon yields no discount on this invoice", 422);

    const discountAmount = invoice.discountAmount + discount;
    const totalAmount = Math.max(0, invoice.subtotal + invoice.taxAmount - discountAmount);
    const balanceDue = Math.max(0, totalAmount - invoice.paidAmount);
    const status: InvoiceStatus =
      balanceDue <= EPSILON ? "PAID" : invoice.paidAmount > 0 ? "PARTIAL" : "UNPAID";

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id },
        data: { discountAmount, totalAmount, balanceDue, status },
      });

      await tx.couponUsage.create({
        data: {
          couponId: coupon.id,
          customerId: invoice.customerId,
          invoiceId: invoice.id,
          appointmentId: invoice.appointmentId,
          discountAmount: discount,
        },
      });

      await tx.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } },
      });

      return updated;
    });

    return ok(
      { invoice: result, couponCode: coupon.code, discountApplied: discount },
      "Coupon applied"
    );
  } catch {
    return err("Internal server error", 500);
  }
}
