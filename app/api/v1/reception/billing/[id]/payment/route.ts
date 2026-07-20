import { NextRequest } from "next/server";
import { created, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { getOrCreateWallet, debitWallet } from "@/lib/wallet";
import { giftCardUsableReason, redeemGiftCard } from "@/lib/gift-cards";
import { earnLoyaltyPoints } from "@/lib/loyalty";
import { sendMail } from "@/lib/mailer";
import { invoiceEmail } from "@/lib/email-templates";
import type { PaymentMethod, InvoiceStatus, PaymentStatus } from "@prisma/client";

const METHODS: PaymentMethod[] = [
  "CASH", "UPI", "CARD", "ONLINE", "WALLET", "GIFT_CARD", "LOYALTY_POINTS", "MEMBERSHIP",
];

// Float tolerance so an exact-change payment isn't rejected by binary rounding.
const EPSILON = 0.01;

// OWNER: Shalmon | MODULE: Reception Payment
// POST /api/v1/reception/billing/[id]/payment
// Body: { method, amount, reference?, notes?, giftCardCode? }
//
// Sources the money according to `method` (draining the wallet or a gift card
// where applicable), records the Payment, settles the invoice, syncs the
// appointment, and awards loyalty points for the amount spent — atomically.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, "RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER");
  if (error) return error;

  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const amount = Number(body.amount);
    const method: PaymentMethod = body.method;

    const errors: Record<string, string[]> = {};
    if (!Number.isFinite(amount) || amount <= 0) errors.amount = ["amount must be a positive number"];
    if (!METHODS.includes(method)) errors.method = ["Invalid payment method"];
    if (Object.keys(errors).length) return err("Validation failed", 422, errors);

    // Points have their own endpoint so redemption rules live in one place.
    if (method === "LOYALTY_POINTS") {
      return err("Use POST /api/v1/customer/loyalty/redeem to pay with points", 400);
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: { select: { name: true, quantity: true, unitPrice: true, total: true } } },
    });
    if (!invoice) return err("Invoice not found", 404);
    if (invoice.status === "CANCELLED") return err("Cannot pay a cancelled invoice", 409);
    if (invoice.status === "PAID") return err("Invoice is already fully paid", 409);

    const remaining = invoice.totalAmount - invoice.paidAmount;
    if (amount > remaining + EPSILON) {
      return err("Payment exceeds the outstanding balance", 422, {
        amount: [`Outstanding balance is ${remaining.toFixed(2)}`],
      });
    }

    // ── Pre-flight the funding source so we fail with a clear 422 rather than
    //    aborting the transaction mid-way.
    let giftCardId: string | null = null;

    if (method === "WALLET") {
      const wallet = await getOrCreateWallet(prisma, invoice.customerId);
      if (wallet.balance < amount) {
        return err("Insufficient wallet balance", 422, {
          amount: [`Wallet balance is ${wallet.balance.toFixed(2)}`],
        });
      }
    }

    if (method === "GIFT_CARD") {
      const code: string = typeof body.giftCardCode === "string" ? body.giftCardCode.trim() : "";
      if (!code) {
        return err("Validation failed", 422, { giftCardCode: ["giftCardCode is required"] });
      }
      const card = await prisma.giftCard.findUnique({ where: { code } });
      if (!card) return err("Gift card not found", 404);

      const reason = giftCardUsableReason(card, amount, invoice.customerId);
      if (reason) return err(reason, 422, { giftCardCode: [reason] });
      giftCardId = card.id;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Draw the funds from their source.
      if (method === "WALLET") {
        await debitWallet(tx, invoice.customerId, amount, "PAYMENT", {
          refId: invoice.id,
          description: `Payment for invoice ${invoice.invoiceNo}`,
        });
      }
      if (method === "GIFT_CARD" && giftCardId) {
        await redeemGiftCard(tx, giftCardId, invoice.id, amount);
      }

      // 2. Record the payment.
      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          method,
          amount,
          reference: typeof body.reference === "string" ? body.reference : null,
          collectedBy: user.userId,
          notes: typeof body.notes === "string" ? body.notes : null,
        },
      });

      // 3. Settle the invoice.
      const paidAmount = invoice.paidAmount + amount;
      const balanceDue = Math.max(0, invoice.totalAmount - paidAmount);
      const fullyPaid = balanceDue <= EPSILON;
      const status: InvoiceStatus = fullyPaid ? "PAID" : "PARTIAL";

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: { paidAmount, balanceDue, status },
      });

      // 4. Keep the source appointment in sync with its invoice.
      if (invoice.appointmentId) {
        const paymentStatus: PaymentStatus = fullyPaid ? "PAID" : "PARTIAL";
        await tx.appointment.update({
          where: { id: invoice.appointmentId },
          data: { paidAmount, paymentStatus },
        });
      }

      // 5. Reward the spend. Tier is recomputed from lifetime earnings.
      const loyalty = await earnLoyaltyPoints(tx, invoice.customerId, amount, {
        refId: invoice.id,
        description: `Earned on invoice ${invoice.invoiceNo}`,
      });

      return {
        payment,
        invoice: updatedInvoice,
        loyalty: loyalty
          ? { availablePoints: loyalty.availablePoints, tier: loyalty.tier }
          : null,
      };
    });

    // Send receipt email when invoice is fully paid (non-blocking — fire and forget).
    if (result.invoice.status === "PAID") {
      Promise.all([
        prisma.customer.findUnique({
          where: { id: invoice.customerId },
          select: { firstName: true, lastName: true, email: true },
        }),
        prisma.branch.findUnique({
          where: { id: invoice.branchId },
          select: { name: true },
        }),
      ]).then(([customer, branch]) => {
        if (!customer?.email) return;
        const { subject, html, text } = invoiceEmail({
          name: `${customer.firstName} ${customer.lastName ?? ""}`.trim(),
          invoiceNo: invoice.invoiceNo,
          date: new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(new Date()),
          branch: branch?.name ?? "",
          items: invoice.items.map((item) => ({
            label: `${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`,
            amount: Number(item.total),
          })),
          subtotal: Number(invoice.subtotal),
          discount: Number(invoice.discountAmount),
          tax: Number(invoice.taxAmount),
          total: Number(invoice.totalAmount),
          paid: Number(result.invoice.paidAmount),
          balance: Number(result.invoice.balanceDue),
          method: method.replace(/_/g, " "),
        });
        return sendMail({ to: customer.email, subject, html, text });
      }).catch((e) => console.error("[Mailer] Receipt email failed:", e));
    }

    return created(result, "Payment recorded");
  } catch {
    return err("Internal server error", 500);
  }
}
