// ============================================================================
// MODULE : Worker Salary Advances
// ROUTE  : /api/v1/admin/workers/[id]/advances
//
// GET  — paginated list of advance/repayment records for the worker
// POST — record a new advance or repayment
//
// ACCESS: BRANCH_ADMIN, OWNER, SUPER_ADMIN
// ============================================================================

import { NextRequest } from "next/server";
import { ok, created, err, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { branchWhere, requireBranchScope, resolveWriteBranchId } from "@/lib/branch-scope";
import { writeAudit } from "@/lib/audit";
import prisma from "@/lib/db";

const ROLES = ["BRANCH_ADMIN", "OWNER", "SUPER_ADMIN"] as const;
const MODULE = "SALARY_ADVANCES";
const VALID_TYPES = ["ADVANCE", "REPAYMENT"] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user, new URL(req.url));
  if (scopeError) return scopeError;

  const { id: workerId } = await params;
  const url = new URL(req.url);
  const { page, limit, skip } = parsePagination(url);

  try {
    const filter = { workerId, ...branchWhere(scope) };

    const [rows, total] = await Promise.all([
      prisma.salaryAdvance.findMany({
        where: filter,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true, amount: true, type: true, reason: true,
          notes: true, givenBy: true, createdAt: true,
          branch: { select: { name: true } },
        },
      }),
      prisma.salaryAdvance.count({ where: filter }),
    ]);

    // Compute totals across ALL records (not just this page) for the summary banner.
    const allRows = await prisma.salaryAdvance.findMany({
      where: filter,
      select: { amount: true, type: true },
    });
    const totalAdvances = allRows.filter((r) => r.type === "ADVANCE").reduce((s, r) => s + r.amount, 0);
    const totalRepayments = allRows.filter((r) => r.type === "REPAYMENT").reduce((s, r) => s + r.amount, 0);

    return ok({
      items: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: { totalAdvances, totalRepayments, outstanding: totalAdvances - totalRepayments },
    });
  } catch {
    return err("Internal server error", 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  const { id: workerId } = await params;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return err("Invalid JSON body", 400);

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return err("Validation failed", 422, { amount: ["Amount must be a positive number"] });
    }

    const type = typeof body.type === "string" && VALID_TYPES.includes(body.type as typeof VALID_TYPES[number])
      ? (body.type as string)
      : "ADVANCE";
    const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;
    const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

    const branchId = resolveWriteBranchId(scope, body.branchId);
    if (!branchId) return err("branchId is required for non-scoped roles", 422);

    const worker = await prisma.workerProfile.findUnique({
      where: { id: workerId },
      select: { id: true, branches: { where: { branchId, isActive: true }, select: { id: true } } },
    });
    if (!worker) return err("Worker not found", 404);
    if (worker.branches.length === 0) return err("Worker is not active in this branch", 403);

    const advance = await prisma.salaryAdvance.create({
      data: {
        workerId,
        branchId,
        amount,
        type,
        reason,
        notes,
        givenBy: user.userId,
      },
      select: {
        id: true, amount: true, type: true, reason: true,
        notes: true, givenBy: true, createdAt: true,
        branch: { select: { name: true } },
      },
    });

    await writeAudit(user, {
      action: "CREATE",
      module: MODULE,
      refId: advance.id,
      refType: "SalaryAdvance",
      newValue: { workerId, branchId, amount, type },
    });

    return created(advance, `${type === "REPAYMENT" ? "Repayment" : "Advance"} recorded`);
  } catch {
    return err("Internal server error", 500);
  }
}
