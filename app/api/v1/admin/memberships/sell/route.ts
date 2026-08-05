// ============================================================================
// MODULE : Manual Operations — sell a membership
// ROUTE  : /api/v1/admin/memberships/sell
//
// METHOD
//   POST — Sell a plan to a customer at the counter, activate it immediately, and
//          raise the invoice. { customerId, planId, branchId?, payments?, notes? }
//
// WHY THIS EXISTS
// ---------------
// MembershipPlan and CustomerMembership both already existed, but nothing could
// CREATE a CustomerMembership — the plans API only listed plans and their
// existing subscribers. This is the missing sale door. It writes the same
// CustomerMembership the rest of the system reads, plus an Invoice with a
// MEMBERSHIP line, so membership revenue lands in the same reports as everything
// else and the benefits apply from the moment it is saved.
//
// The plan's wallet credit is applied through the existing `creditWallet()`,
// so a membership bought at the counter behaves exactly like one bought online.
//
// ACCESS: RECEPTIONIST, BRANCH_ADMIN, SUPER_ADMIN, OWNER.
// ============================================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import type { InvoiceStatus, PaymentMethod } from "@prisma/client";
import { created, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { validate, readJson } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import { genCode } from "@/lib/codes";
import prisma from "@/lib/db";
import { creditWallet } from "@/lib/wallet";
import { operationsCapabilitiesFor, PAYMENT_METHODS } from "@/lib/operations";

const MODULE = "MEMBERSHIP";

const SellSchema = z.object({
  customerId: z.string().trim().min(1, "Choose a customer"),
  planId: z.string().trim().min(1, "Choose a plan"),
  branchId: z.string().trim().min(1).optional(),
  /** Charge something other than the list price (a negotiated or pro-rata rate). */
  priceOverride: z.number().min(0).optional(),
  payments: z
    .array(
      z.object({
        method: z.enum(PAYMENT_METHODS),
        amount: z.number().positive(),
        reference: z.string().trim().max(80).nullable().optional(),
      })
    )
    .max(5)
    .optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(
    req,
    "RECEPTIONIST",
    "BRANCH_ADMIN",
    "SUPER_ADMIN",
    "OWNER"
  );
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  if (!operationsCapabilitiesFor(user.userType).canSellMembership) {
    return err("Forbidden — your role cannot sell memberships", 403);
  }

  const parsed = validate(SellSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  const input = parsed.data;

  try {
    const branchId = scope.isGlobal ? input.branchId ?? null : scope.branchId;
    if (!branchId) return err("Validation failed", 422, { branchId: ["Choose a branch"] });

    const [customer, plan] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: input.customerId },
        select: { id: true, deletedAt: true, branchId: true },
      }),
      prisma.membershipPlan.findUnique({
        where: { id: input.planId },
        select: {
          id: true,
          name: true,
          tier: true,
          price: true,
          validityDays: true,
          walletCredit: true,
          isActive: true,
        },
      }),
    ]);

    if (!customer || customer.deletedAt) {
      return err("Validation failed", 422, { customerId: ["Unknown or deleted customer"] });
    }
    if (!plan || !plan.isActive) {
      return err("Validation failed", 422, { planId: ["Unknown or inactive plan"] });
    }

    // Selling a second live membership would leave two sets of benefits competing;
    // the existing one must be used up, or cancelled, first.
    const live = await prisma.customerMembership.findFirst({
      where: { customerId: customer.id, status: "ACTIVE", endDate: { gte: new Date() } },
      select: { id: true, plan: { select: { name: true } }, endDate: true },
    });
    if (live) {
      return err(
        `This customer already holds an active membership (${live.plan.name}, until ${live.endDate
          .toISOString()
          .slice(0, 10)})`,
        409
      );
    }

    const price = round2(input.priceOverride ?? plan.price);
    const payments = input.payments ?? [];
    const paidAmount = round2(payments.reduce((sum, p) => sum + p.amount, 0));

    if (paidAmount > price) {
      return err("Validation failed", 422, {
        payments: [`Payments (₹${paidAmount}) exceed the price (₹${price})`],
      });
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + plan.validityDays * 24 * 60 * 60 * 1000);
    const balanceDue = round2(Math.max(0, price - paidAmount));
    const status: InvoiceStatus =
      balanceDue <= 0 ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID";

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          invoiceNo: genCode("INV"),
          appointmentId: null,
          customerId: customer.id,
          branchId,
          subtotal: price,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: price,
          paidAmount,
          balanceDue,
          status,
          notes: input.notes ?? null,
          generatedBy: user.userId,
          items: {
            create: [
              {
                type: "MEMBERSHIP",
                refId: plan.id,
                name: `${plan.name} membership`,
                quantity: 1,
                unitPrice: price,
                total: price,
              },
            ],
          },
        },
        include: { items: true },
      });

      for (const payment of payments) {
        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            customerId: customer.id,
            method: payment.method as PaymentMethod,
            amount: payment.amount,
            reference: payment.reference ?? null,
            collectedBy: user.userId,
          },
        });
      }

      // ACTIVE from this instant — the brief's "activate immediately, benefits
      // apply instantly" is simply what an ACTIVE row with today's start means.
      const membership = await tx.customerMembership.create({
        data: {
          customerId: customer.id,
          planId: plan.id,
          status: "ACTIVE",
          startDate,
          endDate,
          invoiceId: invoice.id,
        },
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          plan: { select: { id: true, name: true, tier: true } },
        },
      });

      // A plan that comes with wallet money credits it now, through the same
      // helper the online purchase path uses.
      if (plan.walletCredit > 0) {
        await creditWallet(tx, customer.id, plan.walletCredit, "MEMBERSHIP", {
          description: `${plan.name} membership credit`,
          refId: membership.id,
        });
      }

      // Always mark them as a member once a live plan is attached — paid or
      // complimentary (super-admin grant with priceOverride 0).
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          customerType: "MEMBERSHIP",
          ...(paidAmount > 0 ? { totalSpend: { increment: paidAmount } } : {}),
        },
      });

      return { invoice, membership };
    });

    await writeAudit(user, {
      action: "CREATE",
      module: MODULE,
      refId: result.membership.id,
      refType: "CustomerMembership",
      newValue: {
        customerId: customer.id,
        planId: plan.id,
        planName: plan.name,
        branchId,
        price,
        paidAmount,
        invoiceNo: result.invoice.invoiceNo,
        startDate: startDate.toISOString().slice(0, 10),
        endDate: endDate.toISOString().slice(0, 10),
      },
    });

    return created(result, "Membership sold and activated");
  } catch {
    return err("Internal server error", 500);
  }
}
