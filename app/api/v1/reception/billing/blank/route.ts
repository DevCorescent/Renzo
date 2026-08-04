// ============================================================================
// MODULE : Billing — blank (no-appointment) invoice
// ROUTE  : /api/v1/reception/billing/blank
//
// METHOD
//   POST — Raise an invoice with NO appointment behind it: retail products,
//          a consultation, a miscellaneous charge, or a walk-in service that was
//          never booked.
//
// ACCESS
//   SUPER_ADMIN / OWNER / BRANCH_ADMIN — always, own branch for the branch admin.
//   RECEPTIONIST                       — only if the branch turns on
//                                        `allowReceptionBlankBill`. A blank bill
//                                        has no appointment to audit it against,
//                                        so by default it stays with the people
//                                        accountable for the branch's numbers.
//   WORKER                             — never.
//
// This is NOT a second billing engine: totals come from computeInvoiceTotals(),
// stock moves through applyStockMovement(), loyalty accrues through
// earnLoyaltyPoints(), and the invoice is the same Invoice row an appointment
// bill produces — so it reaches reports, accounting and analytics identically.
// ============================================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import type { PaymentMethod } from "@prisma/client";
import { created, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { validate, readJson } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import { genCode } from "@/lib/codes";
import prisma from "@/lib/db";
import { applyStockMovement, InsufficientStockError } from "@/lib/stock";
import { earnLoyaltyPoints } from "@/lib/loyalty";
import { PAYMENT_METHODS } from "@/lib/operations";
import {
  assertBillingAccess,
  computeInvoiceTotals,
  isTotalsError,
  toInvoiceItemRows,
  type InvoiceLine,
} from "@/lib/billing-service";

const MODULE = "BILLING";

const LineSchema = z.object({
  /** MISC carries a free-text name and price — the consultation / sundry line. */
  kind: z.enum(["PRODUCT", "SERVICE", "MISC"]),
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().max(120).optional(),
  quantity: z.number().int().min(1).max(999).optional(),
  unitPrice: z.number().min(0).optional(),
});

const BlankBillSchema = z.object({
  customerId: z.string().trim().min(1, "Choose a customer"),
  branchId: z.string().trim().min(1).optional(),
  lines: z.array(LineSchema).min(1, "Add at least one line").max(50),
  discountAmount: z.number().min(0).optional(),
  tipAmount: z.number().min(0).optional(),
  roundOff: z.number().min(-10).max(10).optional(),
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

  const parsed = validate(BlankBillSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  const input = parsed.data;

  try {
    const access = await assertBillingAccess({
      userType: user.userType,
      scope,
      targetBranchId: scope.isGlobal ? input.branchId ?? null : scope.branchId,
    });
    if (!access.ok) return err(access.message, access.status);

    if (!access.caps.canBlankBill) {
      return err(
        "Forbidden — your role cannot raise an invoice without an appointment",
        403
      );
    }

    const branchId = access.branchId;

    // ── Customer ──────────────────────────────────────────────────────────
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
      select: { id: true, deletedAt: true },
    });
    if (!customer || customer.deletedAt) {
      return err("Validation failed", 422, { customerId: ["Unknown or deleted customer"] });
    }

    // ── Resolve lines against the catalogue ───────────────────────────────
    const productIds = input.lines.filter((l) => l.kind === "PRODUCT" && l.id).map((l) => l.id!);
    const serviceIds = input.lines.filter((l) => l.kind === "SERVICE" && l.id).map((l) => l.id!);

    const [products, services] = await Promise.all([
      productIds.length
        ? prisma.product.findMany({
            where: { id: { in: productIds }, isActive: true },
            select: { id: true, name: true, sellingPrice: true },
          })
        : Promise.resolve([]),
      serviceIds.length
        ? prisma.service.findMany({
            where: { id: { in: serviceIds }, isActive: true },
            select: { id: true, name: true, basePrice: true },
          })
        : Promise.resolve([]),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    const lines: InvoiceLine[] = [];
    for (const [index, line] of input.lines.entries()) {
      const quantity = line.quantity ?? 1;

      if (line.kind === "MISC") {
        // A free-text charge must still say WHAT it is and cost something.
        if (!line.name || line.unitPrice === undefined) {
          return err("Validation failed", 422, {
            lines: [`Line ${index + 1}: a miscellaneous charge needs a name and a price`],
          });
        }
        lines.push({
          type: "MISC",
          refId: null,
          name: line.name,
          quantity,
          unitPrice: line.unitPrice,
          total: round2(line.unitPrice * quantity),
        });
        continue;
      }

      const found =
        line.kind === "PRODUCT"
          ? productMap.get(line.id ?? "")
          : serviceMap.get(line.id ?? "");
      if (!found) {
        return err("Validation failed", 422, {
          lines: [`Line ${index + 1}: unknown, inactive or deleted item`],
        });
      }

      const cataloguePrice =
        line.kind === "PRODUCT"
          ? (found as { sellingPrice: number }).sellingPrice
          : (found as { basePrice: number }).basePrice;
      const unitPrice = line.unitPrice ?? cataloguePrice;

      lines.push({
        type: line.kind,
        refId: found.id,
        name: found.name,
        quantity,
        unitPrice,
        total: round2(unitPrice * quantity),
      });
    }

    // ── Money ─────────────────────────────────────────────────────────────
    const totals = computeInvoiceTotals({
      lines,
      discountAmount: input.discountAmount,
      taxPercent: access.taxPercent,
      tipAmount: input.tipAmount,
      roundOff: input.roundOff,
      payments: input.payments,
    });
    if (isTotalsError(totals)) {
      return err("Validation failed", 422, { [totals.field]: [totals.error] });
    }

    // ── Write ─────────────────────────────────────────────────────────────
    // One transaction: stock must not move if the invoice fails, and an invoice
    // must not exist for stock that could not be taken.
    const invoice = await prisma.$transaction(async (tx) => {
      const createdInvoice = await tx.invoice.create({
        data: {
          invoiceNo: genCode("INV"),
          appointmentId: null,
          customerId: customer.id,
          branchId,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          discountAmount: totals.discountAmount,
          totalAmount: totals.totalAmount,
          paidAmount: totals.paidAmount,
          balanceDue: totals.balanceDue,
          status: totals.status,
          notes: input.notes ?? null,
          generatedBy: user.userId,
          items: { create: toInvoiceItemRows(lines, totals.tipAmount) },
        },
        include: { items: true },
      });

      // A blank bill still moves stock — requirement 10.
      for (const line of lines) {
        if (line.type !== "PRODUCT" || !line.refId) continue;
        await applyStockMovement(tx, {
          productId: line.refId,
          branchId,
          delta: -line.quantity,
          type: "RETAIL_SALE",
          performedBy: user.userId,
          refId: createdInvoice.id,
          notes: `Blank bill ${createdInvoice.invoiceNo}`,
        });
      }

      for (const payment of input.payments ?? []) {
        await tx.payment.create({
          data: {
            invoiceId: createdInvoice.id,
            customerId: customer.id,
            method: payment.method as PaymentMethod,
            amount: payment.amount,
            reference: payment.reference ?? null,
            collectedBy: user.userId,
          },
        });
      }

      if (totals.paidAmount > 0) {
        await earnLoyaltyPoints(tx, customer.id, totals.paidAmount, {
          refId: createdInvoice.id,
          description: `Blank bill ${createdInvoice.invoiceNo}`,
        });
        await tx.customer.update({
          where: { id: customer.id },
          data: { totalSpend: { increment: totals.paidAmount } },
        });
      }

      return createdInvoice;
    });

    await writeAudit(user, {
      action: "CREATE_BLANK",
      module: MODULE,
      refId: invoice.id,
      refType: "Invoice",
      newValue: {
        invoiceNo: invoice.invoiceNo,
        branchId,
        customerId: customer.id,
        lines: lines.length,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        paidAmount: totals.paidAmount,
        status: totals.status,
      },
    });

    return created(invoice, "Blank invoice generated");
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return err("Validation failed", 422, {
        lines: [`Not enough stock — only ${e.available} left`],
      });
    }
    return err("Internal server error", 500);
  }
}
