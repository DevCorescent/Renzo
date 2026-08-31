// ============================================================================
// MODULE : Manual Operations — Prisma-facing helpers
//
// The data half of lib/operations.ts. Select shapes, the hub's dashboard counters
// and the global search live here so both the routes and the server pages read
// them from one place — a `route.ts` may only export HTTP handlers, so a select
// shared between /expenses and /expenses/[id] cannot live in either of them.
// ============================================================================

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { branchWhere, type BranchScope } from "@/lib/branch-scope";
import { attendanceDateKey } from "@/lib/attendance";

// ============================================================================
// SELECT SHAPES
// ============================================================================

export const EXPENSE_SELECT = {
  id: true,
  category: true,
  customCategory: true,
  amount: true,
  expenseDate: true,
  description: true,
  paidVia: true,
  vendor: true,
  referenceNo: true,
  notes: true,
  createdBy: true,
  createdAt: true,
  branch: { select: { id: true, name: true } },
} satisfies Prisma.ExpenseSelect;

export type ExpenseRecord = Prisma.ExpenseGetPayload<{ select: typeof EXPENSE_SELECT }>;

// ============================================================================
// HUB DASHBOARD
// ============================================================================

export type OperationsSummary = {
  /** "YYYY-MM-DD" the figures are for, in salon-local time. */
  date: string;
  walkInsToday: number;
  manualAppointments: number;
  manualCustomers: number;
  manualBills: number;
  manualAttendance: number;
  /** Rupees collected today across every payment method. */
  manualRevenue: number;
  expensesToday: number;
  /** Manual attendance entries still awaiting approval. */
  pendingApprovals: number;
};

/**
 * The hub's counters for one day, in ONE round of parallel queries.
 *
 * Every count is branch-scoped through `branchWhere(scope)`, so a branch admin's
 * hub reports their own branch and a platform role's reports the whole business —
 * without either passing a branchId that could be tampered with.
 */
export async function loadOperationsSummary(
  scope: BranchScope,
  dateKey?: Date
): Promise<OperationsSummary> {
  const day = dateKey ?? attendanceDateKey();
  const dayStart = new Date(day);
  const dayEnd = new Date(day.getTime() + 24 * 60 * 60 * 1000);

  const branch = branchWhere(scope) as { branchId?: string };
  const scopedBranch = branch.branchId ? { branchId: branch.branchId } : {};

  // Customers carry a nullable branchId (self-registered ones belong to no
  // branch), so a scoped count must not exclude them by accident — it filters on
  // the branch only when there is one.
  const customerBranch = branch.branchId
    ? { OR: [{ branchId: branch.branchId }, { branchId: null }] }
    : {};

  const [
    walkInsToday,
    manualAppointments,
    manualCustomers,
    manualBills,
    manualAttendance,
    revenueAgg,
    expenseAgg,
    pendingApprovals,
  ] = await Promise.all([
    prisma.appointment.count({
      where: { ...scopedBranch, source: "WALK_IN", appointmentDate: day },
    }),
    prisma.appointment.count({
      where: {
        ...scopedBranch,
        source: { in: ["WALK_IN", "PHONE", "WHATSAPP"] },
        appointmentDate: day,
      },
    }),
    prisma.customer.count({
      where: {
        ...customerBranch,
        isManualEntry: true,
        deletedAt: null,
        createdAt: { gte: dayStart, lt: dayEnd },
      },
    }),
    prisma.invoice.count({
      where: { ...scopedBranch, createdAt: { gte: dayStart, lt: dayEnd } },
    }),
    prisma.attendance.count({
      where: { ...scopedBranch, isManual: true, date: day },
    }),
    prisma.payment.aggregate({
      where: {
        paidAt: { gte: dayStart, lt: dayEnd },
        ...(branch.branchId ? { invoice: { branchId: branch.branchId } } : {}),
      },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { ...scopedBranch, expenseDate: day },
      _sum: { amount: true },
    }),
    prisma.attendance.count({
      where: { ...scopedBranch, isManual: true, approvedAt: null },
    }),
  ]);

  return {
    date: day.toISOString().slice(0, 10),
    walkInsToday,
    manualAppointments,
    manualCustomers,
    manualBills,
    manualAttendance,
    manualRevenue: revenueAgg._sum.amount ?? 0,
    expensesToday: expenseAgg._sum.amount ?? 0,
    pendingApprovals,
  };
}

// ============================================================================
// GLOBAL SEARCH
// ============================================================================

export type SearchHit = {
  kind: "customer" | "appointment" | "invoice" | "worker" | "product";
  id: string;
  title: string;
  subtitle: string;
  /** Where clicking it should go, relative to the caller's role prefix. */
  href: string;
};

/** Digits only, so "98765 43210" matches a stored "+919876543210". */
function digits(value: string): string {
  const d = value.replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

/**
 * One query box across the whole front desk.
 *
 * Every branch is applied through `branchWhere(scope)` exactly as the individual
 * modules do, so search can never become the hole through which a branch admin
 * sees another branch's book. Each kind is capped at a handful of rows: this
 * feeds a dropdown, not a report.
 */
export async function globalSearch(
  term: string,
  scope: BranchScope,
  basePath: string
): Promise<SearchHit[]> {
  const q = term.trim();
  if (q.length < 2) return [];

  const branch = branchWhere(scope) as { branchId?: string };
  const scopedBranch = branch.branchId ? { branchId: branch.branchId } : {};
  const phone = digits(q);
  const insensitive = { contains: q, mode: "insensitive" as const };
  const TAKE = 5;

  const [customers, appointments, invoices, workers, products] = await Promise.all([
    prisma.customer.findMany({
      where: {
        deletedAt: null,
        ...(branch.branchId
          ? { OR: [{ branchId: branch.branchId }, { branchId: null }] }
          : {}),
        AND: [
          {
            OR: [
              { firstName: insensitive },
              { lastName: insensitive },
              { email: insensitive },
              ...(phone ? [{ phone: { contains: phone } }] : []),
            ],
          },
        ],
      },
      take: TAKE,
      orderBy: { totalVisits: "desc" },
      select: { id: true, firstName: true, lastName: true, phone: true, totalVisits: true },
    }),

    prisma.appointment.findMany({
      where: {
        ...scopedBranch,
        OR: [
          { appointmentNo: insensitive },
          { customer: { is: { firstName: insensitive } } },
          ...(phone ? [{ customer: { is: { phone: { contains: phone } } } }] : []),
        ],
      },
      take: TAKE,
      orderBy: { appointmentDate: "desc" },
      select: {
        id: true,
        appointmentNo: true,
        appointmentDate: true,
        status: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    }),

    prisma.invoice.findMany({
      where: { ...scopedBranch, invoiceNo: insensitive },
      take: TAKE,
      orderBy: { createdAt: "desc" },
      select: { id: true, invoiceNo: true, totalAmount: true, status: true },
    }),

    prisma.workerProfile.findMany({
      where: {
        isActive: true,
        ...(branch.branchId
          ? { branches: { some: { branchId: branch.branchId, isActive: true } } }
          : {}),
        OR: [
          { firstName: insensitive },
          { lastName: insensitive },
          { displayName: insensitive },
          { employeeCode: insensitive },
        ],
      },
      take: TAKE,
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
    }),

    prisma.product.findMany({
      where: { isActive: true, OR: [{ name: insensitive }, { sku: insensitive }] },
      take: TAKE,
      select: { id: true, name: true, sku: true, sellingPrice: true },
    }),
  ]);

  return [
    ...customers.map((c): SearchHit => ({
      kind: "customer",
      id: c.id,
      title: `${c.firstName} ${c.lastName ?? ""}`.trim(),
      subtitle: `${c.phone ?? "No phone"} · ${c.totalVisits} visit${c.totalVisits === 1 ? "" : "s"}`,
      href: `${basePath}/customers/${c.id}`,
    })),
    ...appointments.map((a): SearchHit => ({
      kind: "appointment",
      id: a.id,
      title: a.appointmentNo,
      subtitle: `${a.customer.firstName} ${a.customer.lastName ?? ""}`.trim() +
        ` · ${a.appointmentDate.toISOString().slice(0, 10)} · ${a.status}`,
      href: `${basePath}/calendar`,
    })),
    ...invoices.map((i): SearchHit => ({
      kind: "invoice",
      id: i.id,
      title: i.invoiceNo,
      subtitle: `₹${i.totalAmount.toLocaleString("en-IN")} · ${i.status}`,
      href: `${basePath}/billing/${i.id}`,
    })),
    ...workers.map((w): SearchHit => ({
      kind: "worker",
      id: w.id,
      title: `${w.firstName} ${w.lastName ?? ""}`.trim(),
      subtitle: w.employeeCode,
      href: `${basePath}/workers`,
    })),
    ...products.map((p): SearchHit => ({
      kind: "product",
      id: p.id,
      title: p.name,
      subtitle: `${p.sku} · ₹${p.sellingPrice.toLocaleString("en-IN")}`,
      href: `${basePath}/inventory`,
    })),
  ];
}
