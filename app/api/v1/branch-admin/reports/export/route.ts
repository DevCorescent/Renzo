// ============================================================================
// MODULE : Branch Admin Reports — export data
// ROUTE  : /api/v1/branch-admin/reports/export
//
// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD
//     Everything the Reports page needs to build its downloadable reports for
//     one period: invoices (with items + payments), payments collected,
//     appointments (with services) and expenses. The client shapes these into
//     report tables, so one fetch serves every report type.
//
//     Timestamps (invoice createdAt, payment paidAt) are bucketed by India
//     calendar day; @db.Date columns (appointmentDate, expenseDate) are used as-is.
//
// ACCESS: BRANCH_ADMIN, OWNER, SUPER_ADMIN
// ============================================================================

import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { ok, err } from "@/lib/response";
import prisma from "@/lib/db";

const ROLES = ["BRANCH_ADMIN", "OWNER", "SUPER_ADMIN"] as const;
const MAX_DAYS = 400;
const IST = "+05:30";

const personName = (p: { firstName: string; lastName: string | null } | null | undefined) =>
  p ? `${p.firstName} ${p.lastName ?? ""}`.trim() : "";

/** India calendar day of an instant, as YYYY-MM-DD. */
const istDay = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;

  const branchId = user.branchId;
  if (!branchId) return err("No branch associated with your account", 403);

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? "";
  const to   = searchParams.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to))
    return err("from and to must be YYYY-MM-DD", 400);
  if (from > to) return err("from must be before to", 400);

  const dayFrom = new Date(from), dayTo = new Date(to);              // @db.Date columns
  const tsFrom  = new Date(`${from}T00:00:00.000${IST}`);            // timestamp columns
  const tsTo    = new Date(`${to}T23:59:59.999${IST}`);
  if ((dayTo.getTime() - dayFrom.getTime()) / 86_400_000 > MAX_DAYS)
    return err(`Pick a period of at most ${MAX_DAYS} days`, 400);

  const [branch, invoices, payments, appointments, expenses] = await Promise.all([
    prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } }),

    prisma.invoice.findMany({
      where: { branchId, createdAt: { gte: tsFrom, lte: tsTo } },
      orderBy: { createdAt: "asc" },
      select: {
        invoiceNo: true, customerId: true, createdAt: true, status: true,
        subtotal: true, discountAmount: true, taxAmount: true, totalAmount: true, paidAmount: true, balanceDue: true,
        items: { select: { type: true, name: true, quantity: true, unitPrice: true, discount: true, taxAmount: true, total: true } },
        payments: { select: { method: true } },
      },
    }),

    prisma.payment.findMany({
      where: { invoice: { branchId }, paidAt: { gte: tsFrom, lte: tsTo } },
      orderBy: { paidAt: "asc" },
      select: {
        method: true, amount: true, reference: true, paidAt: true, customerId: true,
        invoice: { select: { invoiceNo: true } },
      },
    }),

    prisma.appointment.findMany({
      where: { branchId, appointmentDate: { gte: dayFrom, lte: dayTo } },
      orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
      select: {
        appointmentNo: true, appointmentDate: true, startTime: true, status: true, source: true,
        totalAmount: true, paidAmount: true, paymentStatus: true, customerId: true,
        customer: { select: { firstName: true, lastName: true, phone: true } },
        worker:   { select: { id: true, firstName: true, lastName: true } },
        services: {
          select: {
            price: true, status: true,
            service: { select: { name: true } },
            worker:  { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    }),

    prisma.expense.findMany({
      where: { branchId, expenseDate: { gte: dayFrom, lte: dayTo } },
      orderBy: { expenseDate: "asc" },
      select: {
        expenseDate: true, category: true, customCategory: true, description: true,
        vendor: true, paidVia: true, referenceNo: true, amount: true,
      },
    }),
  ]);

  // Invoices and payments carry only a customerId — resolve names in one query.
  const customerIds = [...new Set([...invoices.map((i) => i.customerId), ...payments.map((p) => p.customerId)])];
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true, firstName: true, lastName: true, phone: true },
  });
  const customerById = new Map(customers.map((c) => [c.id, c]));

  return ok({
    branchName: branch?.name ?? "Renzo",
    from, to,
    invoices: invoices.map((i) => ({
      invoiceNo: i.invoiceNo,
      date: istDay(i.createdAt),
      customer: personName(customerById.get(i.customerId)),
      phone: customerById.get(i.customerId)?.phone ?? "",
      status: i.status,
      subtotal: i.subtotal, discount: i.discountAmount, tax: i.taxAmount,
      total: i.totalAmount, paid: i.paidAmount, balance: i.balanceDue,
      methods: [...new Set(i.payments.map((p) => p.method))],
      items: i.items,
    })),
    payments: payments.map((p) => ({
      date: istDay(p.paidAt),
      time: p.paidAt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }),
      invoiceNo: p.invoice.invoiceNo,
      customer: personName(customerById.get(p.customerId)),
      method: p.method,
      reference: p.reference ?? "",
      amount: p.amount,
    })),
    appointments: appointments.map((a) => ({
      appointmentNo: a.appointmentNo,
      date: a.appointmentDate.toISOString().slice(0, 10),
      time: a.startTime,
      customer: personName(a.customer),
      phone: a.customer?.phone ?? "",
      worker: personName(a.worker),
      status: a.status,
      source: a.source,
      total: a.totalAmount,
      paid: a.paidAmount,
      paymentStatus: a.paymentStatus,
      services: a.services.map((s) => ({
        name: s.service.name,
        price: s.price,
        status: s.status,
        // A service line without its own worker was done by the booking's worker.
        workerId: s.worker?.id ?? a.worker?.id ?? null,
        worker: personName(s.worker ?? a.worker),
      })),
      customerId: a.customerId,
    })),
    expenses: expenses.map((e) => ({
      date: e.expenseDate.toISOString().slice(0, 10),
      category: e.category === "OTHERS" && e.customCategory ? e.customCategory : e.category,
      description: e.description,
      vendor: e.vendor ?? "",
      paidVia: e.paidVia,
      reference: e.referenceNo ?? "",
      amount: e.amount,
    })),
  });
}
