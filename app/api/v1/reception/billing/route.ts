// ============================================================================
// OWNER: Shalmon | MODULE: Reception Billing
// ROUTE : /api/v1/reception/billing
//
// GET  — Invoice list for the desk, branch-scoped.
// POST — Generate an invoice FROM AN APPOINTMENT.
//
// THREE BUGS FIXED HERE
// ---------------------
// 1. TENANCY (list): `?branchId=` from the client used to override the session,
//    and a caller with no branch saw every branch. Both now come from
//    requireBranchScope(), which ignores a client-supplied branchId for a scoped
//    role — the precise pattern lib/branch-scope.ts exists to kill.
// 2. TENANCY (create): any receptionist could invoice ANY branch's appointment.
//    assertBillingAccess() settles branch and role together.
// 3. TAX: the invoice copied `appointment.taxAmount`, which every booking path
//    sets to 0 — so no invoice ever charged GST. Tax now comes from the branch's
//    live BranchSetting at the moment the bill is raised.
//
// Blank (no-appointment) billing lives at ./blank; the direct product sale lives
// at /api/v1/reception/sale. All three share lib/billing-service.ts.
// ============================================================================

import { NextRequest } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { branchWhere, requireBranchScope } from "@/lib/branch-scope";
import { writeAudit } from "@/lib/audit";
import prisma from "@/lib/db";
import { genCode } from "@/lib/codes";
import type { InvoiceStatus, Prisma } from "@prisma/client";
import {
  appointmentBillableReason,
  assertBillingAccess,
  computeInvoiceTotals,
  isTotalsError,
  round2,
  toInvoiceItemRows,
  type InvoiceLine,
} from "@/lib/billing-service";
import { applyStockMovement, InsufficientStockError } from "@/lib/stock";

const MODULE = "BILLING";
const ROLES = ["RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"] as const;

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;

  const url = new URL(req.url);
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  try {
    const { page, limit, skip, search } = parsePagination(url);
    const status = url.searchParams.get("status");

    const where: Prisma.InvoiceWhereInput = {
      ...branchWhere(scope),
      ...(status ? { status: status as InvoiceStatus } : {}),
      ...(search ? { invoiceNo: { contains: search, mode: "insensitive" } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true, payments: true } } },
      }),
      prisma.invoice.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

// POST — Body: { appointmentId, discountAmount?, tipAmount?, roundOff?, notes? }
export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const appointmentId: string =
      typeof body.appointmentId === "string" ? body.appointmentId : "";
    if (!appointmentId) {
      return err("Validation failed", 422, { appointmentId: ["appointmentId is required"] });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        invoice: { select: { id: true } },
        services: { include: { service: { select: { name: true } } } },
        addOns: { include: { addOn: { select: { name: true } } } },
        packages: { include: { package: { select: { name: true } } } },
      },
    });
    if (!appointment) return err("Appointment not found", 404);

    // Branch + role + the tax rate that applies, in one place.
    const access = await assertBillingAccess({
      userType: user.userType,
      scope,
      targetBranchId: appointment.branchId,
    });
    if (!access.ok) return err(access.message, access.status);
    if (!access.caps.canBillAppointment) {
      return err("Forbidden — your role cannot generate invoices", 403);
    }

    const blocked = appointmentBillableReason(appointment.status, Boolean(appointment.invoice));
    if (blocked) return err(blocked, 409);

    // One line per booked service / add-on / package.
    const lines: InvoiceLine[] = [
      ...appointment.services.map((s) => ({
        type: "SERVICE",
        refId: s.serviceId,
        name: s.service.name,
        quantity: 1,
        unitPrice: s.price,
        total: s.price,
      })),
      ...appointment.addOns.map((a) => ({
        type: "ADDON",
        refId: a.addOnId,
        name: a.addOn.name,
        quantity: 1,
        unitPrice: a.price,
        total: a.price,
      })),
      ...appointment.packages.map((p) => ({
        type: "PACKAGE",
        refId: p.packageId,
        name: p.package.name,
        quantity: 1,
        unitPrice: p.price,
        total: p.price,
      })),
    ];

    // Ad-hoc lines added at the desk: a service or retail product the customer
    // also took but was never booked, or a miscellaneous charge. This is what
    // stops appointment billing being a dead end when the booking missed
    // something. Product lines move stock in the same transaction as the invoice.
    const extraLinesRaw: unknown[] = Array.isArray(body.extraLines) ? body.extraLines : [];
    if (extraLinesRaw.length > 50) {
      return err("Validation failed", 422, { extraLines: ["Too many extra lines"] });
    }

    const idsOfKind = (kind: string) =>
      extraLinesRaw
        .filter(
          (l): l is { kind: string; id: string } =>
            !!l && typeof l === "object" && (l as { kind?: unknown }).kind === kind &&
            typeof (l as { id?: unknown }).id === "string"
        )
        .map((l) => l.id);

    const extraServiceIds = idsOfKind("SERVICE");
    const extraProductIds = idsOfKind("PRODUCT");

    const [extraServices, extraProducts] = await Promise.all([
      extraServiceIds.length
        ? prisma.service.findMany({
            where: { id: { in: extraServiceIds }, isActive: true },
            select: { id: true, name: true, basePrice: true },
          })
        : Promise.resolve([]),
      extraProductIds.length
        ? prisma.product.findMany({
            where: { id: { in: extraProductIds }, isActive: true },
            select: { id: true, name: true, sellingPrice: true },
          })
        : Promise.resolve([]),
    ]);
    const extraServiceMap = new Map(extraServices.map((s) => [s.id, s]));
    const extraProductMap = new Map(extraProducts.map((p) => [p.id, p]));

    // Products added here must have their stock taken when the invoice commits.
    const productMovements: { productId: string; quantity: number; name: string }[] = [];

    for (const [i, raw] of extraLinesRaw.entries()) {
      if (!raw || typeof raw !== "object") continue;
      const l = raw as { kind?: unknown; id?: unknown; name?: unknown; quantity?: unknown; unitPrice?: unknown };
      const qty = Number.isFinite(Number(l.quantity))
        ? Math.max(1, Math.min(999, Math.trunc(Number(l.quantity))))
        : 1;

      if (l.kind === "MISC") {
        const name = typeof l.name === "string" ? l.name.trim() : "";
        const price = Number(l.unitPrice);
        if (!name || !Number.isFinite(price) || price < 0) {
          return err("Validation failed", 422, {
            extraLines: [`Line ${i + 1}: a custom charge needs a name and a price`],
          });
        }
        lines.push({ type: "MISC", refId: null, name, quantity: qty, unitPrice: round2(price), total: round2(price * qty) });
      } else if (l.kind === "SERVICE") {
        const svc = typeof l.id === "string" ? extraServiceMap.get(l.id) : undefined;
        if (!svc) {
          return err("Validation failed", 422, {
            extraLines: [`Line ${i + 1}: unknown or inactive service`],
          });
        }
        const unit = Number.isFinite(Number(l.unitPrice)) ? Number(l.unitPrice) : svc.basePrice;
        lines.push({ type: "SERVICE", refId: svc.id, name: svc.name, quantity: qty, unitPrice: round2(unit), total: round2(unit * qty) });
      } else if (l.kind === "PRODUCT") {
        const prod = typeof l.id === "string" ? extraProductMap.get(l.id) : undefined;
        if (!prod) {
          return err("Validation failed", 422, {
            extraLines: [`Line ${i + 1}: unknown or inactive product`],
          });
        }
        const unit = Number.isFinite(Number(l.unitPrice)) ? Number(l.unitPrice) : prod.sellingPrice;
        lines.push({ type: "PRODUCT", refId: prod.id, name: prod.name, quantity: qty, unitPrice: round2(unit), total: round2(unit * qty) });
        productMovements.push({ productId: prod.id, quantity: qty, name: prod.name });
      } else {
        return err("Validation failed", 422, {
          extraLines: [`Line ${i + 1}: only services, products and custom charges can be added here`],
        });
      }
    }

    if (lines.length === 0) return err("Appointment has no billable services", 422);

    const totals = computeInvoiceTotals({
      lines,
      // An explicit discount wins; otherwise whatever was agreed at booking.
      discountAmount:
        body.discountAmount != null ? Number(body.discountAmount) : appointment.discountAmount ?? 0,
      taxPercent: access.taxPercent,
      tipAmount: body.tipAmount != null ? Number(body.tipAmount) : 0,
      roundOff: body.roundOff != null ? Number(body.roundOff) : 0,
      // Anything already collected against the booking (an advance).
      payments: appointment.paidAmount > 0 ? [{ amount: appointment.paidAmount }] : [],
    });

    if (isTotalsError(totals)) {
      return err("Validation failed", 422, { [totals.field]: [totals.error] });
    }

    // One transaction: retail stock must not move if the invoice fails, and an
    // invoice must not exist for stock that could not be taken.
    const invoice = await prisma.$transaction(async (tx) => {
      const createdInvoice = await tx.invoice.create({
        data: {
          invoiceNo: genCode("INV"),
          appointmentId: appointment.id,
          customerId: appointment.customerId,
          branchId: appointment.branchId,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          discountAmount: totals.discountAmount,
          totalAmount: totals.totalAmount,
          paidAmount: totals.paidAmount,
          balanceDue: totals.balanceDue,
          status: totals.status,
          notes: typeof body.notes === "string" ? body.notes : null,
          generatedBy: user.userId,
          items: { create: toInvoiceItemRows(lines, totals.tipAmount) },
        },
        include: { items: true },
      });

      for (const m of productMovements) {
        await applyStockMovement(tx, {
          productId: m.productId,
          branchId: appointment.branchId,
          delta: -m.quantity,
          type: "RETAIL_SALE",
          performedBy: user.userId,
          refId: createdInvoice.id,
          notes: `Added on bill ${createdInvoice.invoiceNo}`,
        });
      }

      return createdInvoice;
    });

    await writeAudit(user, {
      action: "CREATE",
      module: MODULE,
      refId: invoice.id,
      refType: "Invoice",
      newValue: {
        invoiceNo: invoice.invoiceNo,
        appointmentId: appointment.id,
        branchId: appointment.branchId,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        status: totals.status,
      },
    });

    return created(invoice, "Invoice generated");
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return err("Validation failed", 422, {
        extraLines: [`Not enough stock — only ${e.available} left`],
      });
    }
    return err("Internal server error", 500);
  }
}
