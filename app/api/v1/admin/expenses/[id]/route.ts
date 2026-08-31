// ============================================================================
// MODULE : Manual Operations — branch expenses
// ROUTE  : /api/v1/admin/expenses/:id
//
// METHODS
//   PATCH  — Correct a recorded expense.
//   DELETE — Remove one. A hard delete is correct HERE, unlike customers: an
//            expense has no dependent transactional history, and a mistyped
//            petty-cash line should not linger in every total forever. The
//            AuditLog keeps the full before-image either way.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN (own branch only).
// ============================================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { err, ok } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
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

const PatchSchema = z
  .object({
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  customCategory: z.string().trim().max(60).nullable().optional(),
  amount: z.number().positive().max(10_000_000).optional(),
  expenseDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional(),
  description: z.string().trim().min(2).max(200).optional(),
  paidVia: z.enum(EXPENSE_PAYMENT_METHODS).optional(),
  vendor: z.string().trim().max(120).nullable().optional(),
  referenceNo: z.string().trim().max(60).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  })
  // Changing the category TO Others requires a typed label in the same request.
  .refine((v) => v.category !== "OTHERS" || !!v.customCategory?.trim(), {
    path: ["customCategory"],
    message: "Type the category name",
  });

/** Load an expense the caller is allowed to touch, or null. */
async function loadInScope(id: string, branchId: string | null) {
  const expense = await prisma.expense.findUnique({
    where: { id },
    select: {
      id: true, branchId: true, category: true, customCategory: true, amount: true, expenseDate: true,
      description: true, paidVia: true, vendor: true, referenceNo: true, notes: true,
    },
  });
  if (!expense) return null;
  // 404 rather than 403: another branch's expense should not be discoverable.
  if (branchId && expense.branchId !== branchId) return null;
  return expense;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  if (!operationsCapabilitiesFor(user.userType).canRecordExpense) {
    return err("Forbidden — your role cannot edit expenses", 403);
  }

  const parsed = validate(PatchSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  const input = parsed.data;

  try {
    const { id } = await params;

    const existing = await loadInScope(id, scope.isGlobal ? null : scope.branchId);
    if (!existing) return err("Expense not found", 404);

    if (input.expenseDate && input.expenseDate > new Date().toISOString().slice(0, 10)) {
      return err("Validation failed", 422, {
        expenseDate: ["An expense cannot be dated in the future"],
      });
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...(input.category !== undefined ? { category: input.category } : {}),
        // Keep customCategory consistent with category: cleared when the
        // category moves away from Others, set when it is Others or when only
        // the label itself is being corrected.
        ...(input.category !== undefined && input.category !== "OTHERS"
          ? { customCategory: null }
          : input.category === "OTHERS"
            ? { customCategory: input.customCategory!.trim() }
            : input.customCategory !== undefined
              ? { customCategory: input.customCategory?.trim() || null }
              : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.expenseDate !== undefined
          ? { expenseDate: new Date(`${input.expenseDate}T00:00:00.000Z`) }
          : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.paidVia !== undefined ? { paidVia: input.paidVia } : {}),
        ...(input.vendor !== undefined ? { vendor: input.vendor } : {}),
        ...(input.referenceNo !== undefined ? { referenceNo: input.referenceNo } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
      select: EXPENSE_SELECT,
    });

    await writeAudit(user, {
      action: "UPDATE",
      module: MODULE,
      refId: id,
      refType: "Expense",
      oldValue: JSON.parse(JSON.stringify(existing)),
      newValue: JSON.parse(JSON.stringify(input)),
    });

    return ok(expense, "Expense updated");
  } catch {
    return err("Internal server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  if (!operationsCapabilitiesFor(user.userType).canRecordExpense) {
    return err("Forbidden — your role cannot delete expenses", 403);
  }

  try {
    const { id } = await params;

    const existing = await loadInScope(id, scope.isGlobal ? null : scope.branchId);
    if (!existing) return err("Expense not found", 404);

    await prisma.expense.delete({ where: { id } });

    await writeAudit(user, {
      action: "DELETE",
      module: MODULE,
      refId: id,
      refType: "Expense",
      oldValue: JSON.parse(JSON.stringify(existing)),
    });

    return ok({ id }, "Expense deleted");
  } catch {
    return err("Internal server error", 500);
  }
}
