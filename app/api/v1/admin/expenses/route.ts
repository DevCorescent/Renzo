// ============================================================================
// MODULE : Manual Operations — branch expenses
// ROUTE  : /api/v1/admin/expenses
//
// METHODS
//   GET  — Paginated, branch-scoped expense list with a category/date filter and
//          a total for the filtered set.
//   POST — Record one expense.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN. Not the front desk — money leaving
//   the branch is not a reception capability (see operationsCapabilitiesFor).
//
// Expenses are the ONE new model in the manual-operations module; every other
// manual action writes through a model that already existed.
// ============================================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { branchWhere, requireBranchScope } from "@/lib/branch-scope";
import { validate, readJson } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import prisma from "@/lib/db";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
  operationsCapabilitiesFor,
} from "@/lib/operations";
import { EXPENSE_SELECT } from "@/lib/operations-service";

const MODULE = "EXPENSE";
const ROLES = ["SUPER_ADMIN", "OWNER", "BRANCH_ADMIN"] as const;

const DateKey = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

const ExpenseSchema = z
  .object({
  branchId: z.string().trim().min(1).optional(),
  category: z.enum(EXPENSE_CATEGORIES),
  customCategory: z.string().trim().max(60).nullable().optional(),
  amount: z
    .number()
    .positive("Amount must be greater than zero")
    .max(10_000_000, "That amount looks wrong — check it"),
  expenseDate: DateKey.optional(),
  description: z.string().trim().min(2, "Describe what this was for").max(200),
  paidVia: z.enum(EXPENSE_PAYMENT_METHODS).optional(),
  vendor: z.string().trim().max(120).nullable().optional(),
  referenceNo: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  })
  // A typed label is required when the category is OTHERS, and meaningless
  // otherwise.
  .refine((v) => v.category !== "OTHERS" || !!v.customCategory?.trim(), {
    path: ["customCategory"],
    message: "Type the category name",
  });

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;

  const url = new URL(req.url);
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  try {
    const { page, limit, skip } = parsePagination(url);

    const from = url.searchParams.get("from")?.trim();
    const to = url.searchParams.get("to")?.trim();
    const categoryRaw = url.searchParams.get("category")?.trim() ?? "";
    const category = (EXPENSE_CATEGORIES as readonly string[]).includes(categoryRaw)
      ? (categoryRaw as (typeof EXPENSE_CATEGORIES)[number])
      : null;

    const where: Prisma.ExpenseWhereInput = {
      ...branchWhere(scope),
      ...(category ? { category } : {}),
      ...(from || to
        ? {
            expenseDate: {
              ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
              ...(to ? { lte: new Date(`${to}T00:00:00.000Z`) } : {}),
            },
          }
        : {}),
    };

    // The total is the point of an expense list, so it is computed over the whole
    // filtered set rather than the visible page.
    const [items, total, sum] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
        select: EXPENSE_SELECT,
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);

    return paginated(
      items.map((e) => ({ ...e, filteredTotal: sum._sum.amount ?? 0 })),
      total,
      page,
      limit
    );
  } catch {
    return err("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  if (!operationsCapabilitiesFor(user.userType).canRecordExpense) {
    return err("Forbidden — your role cannot record expenses", 403);
  }

  const parsed = validate(ExpenseSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  const input = parsed.data;

  try {
    // A branch-scoped caller books against their own branch and cannot name
    // another's; a platform role must say which branch the money left.
    const branchId = scope.isGlobal ? input.branchId ?? null : scope.branchId;
    if (!branchId) {
      return err("Validation failed", 422, { branchId: ["Choose a branch"] });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });
    if (!branch) return err("Validation failed", 422, { branchId: ["Unknown branch"] });

    const today = new Date().toISOString().slice(0, 10);
    const dateKey = input.expenseDate ?? today;
    if (dateKey > today) {
      return err("Validation failed", 422, {
        expenseDate: ["An expense cannot be dated in the future"],
      });
    }

    const expense = await prisma.expense.create({
      data: {
        branchId,
        category: input.category,
        customCategory: input.category === "OTHERS" ? input.customCategory!.trim() : null,
        amount: input.amount,
        expenseDate: new Date(`${dateKey}T00:00:00.000Z`),
        description: input.description,
        paidVia: input.paidVia ?? "CASH",
        vendor: input.vendor ?? null,
        referenceNo: input.referenceNo ?? null,
        notes: input.notes ?? null,
        createdBy: user.userId,
      },
      select: EXPENSE_SELECT,
    });

    await writeAudit(user, {
      action: "CREATE",
      module: MODULE,
      refId: expense.id,
      refType: "Expense",
      newValue: {
        branchId,
        category: expense.category,
        amount: expense.amount,
        expenseDate: dateKey,
        description: expense.description,
        paidVia: expense.paidVia,
      },
    });

    return created(expense, "Expense recorded");
  } catch {
    return err("Internal server error", 500);
  }
}
