import { NextRequest } from "next/server";
import { created, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/db";
import { getOrCreateLoyaltyAccount, getLoyaltyConfig } from "@/lib/loyalty";
import type { InvoiceStatus, PaymentStatus } from "@prisma/client";

const EPSILON = 0.01;

// OWNER: Shalmon | MODULE: Customer Loyalty Redeem
// POST /api/v1/customer/loyalty/redeem — Body: { points, invoiceId }
// Converts points into a LOYALTY_POINTS payment against the customer's invoice.
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, "CUSTOMER");
  if (error) return error;
  if (!user.customerId) return err("Customer profile not found", 403);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const points = Number(body.points);
    const invoiceId: string = typeof body.invoiceId === "string" ? body.invoiceId : "";

    const errors: Record<string, string[]> = {};
    if (!Number.isInteger(points) || points <= 0) errors.points = ["points must be a positive integer"];
    if (!invoiceId) errors.invoiceId = ["invoiceId is required"];
    if (Object.keys(errors).length) return err("Validation failed", 422, errors);

    const [account, config, invoice] = await Promise.all([
      getOrCreateLoyaltyAccount(prisma, user.customerId),
      getLoyaltyConfig(prisma),
      prisma.invoice.findUnique({ where: { id: invoiceId } }),
    ]);

    if (!invoice) return err("Invoice not found", 404);
    if (invoice.customerId !== user.customerId) {
      return err("Forbidden — invoice belongs to another customer", 403);
    }
    if (invoice.status === "CANCELLED") return err("Cannot pay a cancelled invoice", 409);
    if (invoice.status === "PAID") return err("Invoice is already fully paid", 409);

    if (points < config.minRedemption) {
      return err("Below minimum redemption", 422, {
        points: [`Minimum redemption is ${config.minRedemption} points`],
      });
    }
    if (points > account.availablePoints) {
      return err("Insufficient points", 422, {
        points: [`You have ${account.availablePoints} points available`],
      });
    }

    const redeemValue = points * config.redemptionValue;
    const remaining = invoice.totalAmount - invoice.paidAmount;
    const maxByPolicy = (invoice.totalAmount * config.maxRedemptionPct) / 100;
    const cap = Math.min(maxByPolicy, remaining);

    if (redeemValue > cap + EPSILON) {
      return err("Redemption exceeds the allowed limit", 422, {
        points: [
          `Points worth ${redeemValue.toFixed(2)} exceed the max redeemable ${cap.toFixed(2)} ` +
            `(${config.maxRedemptionPct}% of bill, capped at outstanding balance)`,
        ],
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const balanceBefore = account.availablePoints;
      const balanceAfter = balanceBefore - points;

      const updatedAccount = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          availablePoints: balanceAfter,
          lifetimeRedeemed: account.lifetimeRedeemed + points,
        },
      });

      await tx.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          type: "REDEEMED",
          points,
          balanceBefore,
          balanceAfter,
          refId: invoice.id,
          description: `Redeemed against invoice ${invoice.invoiceNo}`,
        },
      });

      const payment = await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          method: "LOYALTY_POINTS",
          amount: redeemValue,
          reference: `${points} points`,
          collectedBy: user.userId,
        },
      });

      const paidAmount = invoice.paidAmount + redeemValue;
      const balanceDue = Math.max(0, invoice.totalAmount - paidAmount);
      const fullyPaid = balanceDue <= EPSILON;
      const status: InvoiceStatus = fullyPaid ? "PAID" : "PARTIAL";

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: { paidAmount, balanceDue, status },
      });

      if (invoice.appointmentId) {
        const paymentStatus: PaymentStatus = fullyPaid ? "PAID" : "PARTIAL";
        await tx.appointment.update({
          where: { id: invoice.appointmentId },
          data: { paidAmount, paymentStatus },
        });
      }

      return { payment, invoice: updatedInvoice, account: updatedAccount };
    });

    return created(
      { ...result, pointsRedeemed: points, valueApplied: Number(redeemValue.toFixed(2)) },
      "Points redeemed"
    );
  } catch {
    return err("Internal server error", 500);
  }
}
