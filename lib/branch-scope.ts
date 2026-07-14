import type { Prisma } from "@prisma/client";
import { err } from "@/lib/response";
import type { AuthUser, UserType } from "@/types/api";

// MODULE: Tenancy — reusable branch-scoping primitive
//
// `requireAuth()` answers ONE question: "is your ROLE allowed on this route?"
// This module answers the OTHER one: "which BRANCH are you allowed to touch?"
//
// The two compose. requireAuth is NOT modified and every existing call site
// keeps working:
//
//   const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
//   if (error) return error;
//
//   const { scope, error: scopeError } = requireBranchScope(user, new URL(req.url));
//   if (scopeError) return scopeError;
//
//   const where = { ...branchWhere(scope) };            // models WITH a branchId column
//   const denied = await denyIfWorkerOutOfScope(prisma, id, scope);  // WorkerProfile (no branchId)
//   if (denied) return denied;
//
// THE BUG THIS EXISTS TO KILL
// ---------------------------
// The pattern `...(branchId ? { branchId } : {})`, where `branchId` comes from a
// query param, means: omit the param -> no filter -> EVERY branch. That is how a
// branch admin currently reads other branches' data. Here, a branch-scoped role's
// branch comes from the JWT and a client-supplied branchId is IGNORED, never
// honoured — and a scoped role with no branch on their account is DENIED rather
// than silently falling through to an unfiltered query.
//
// REUSE
// -----
// Deliberately generic. Appointments, Reviews, Inventory, Reports, Billing and
// Customers can all adopt this as-is: they own a `branchId` column, so
// branchWhere() / denyIfOutOfScope() / resolveWriteBranchId() cover them without
// change. Only WorkerProfile needs the two worker-specific helpers at the bottom,
// because it has NO branchId column — a worker's branch lives in the WorkerBranch
// join table.

/** How a role sees the platform. */
type ScopeKind =
  /** Sees every branch. May optionally narrow with ?branchId=. */
  | "GLOBAL"
  /** Pinned to the single branch on their account. Cannot see any other. */
  | "BRANCH"
  /** Only ever sees their own records — never a branch-wide list. */
  | "SELF";

// Exhaustive by construction: `Record<UserType, …>` makes TypeScript fail the
// build if a new role is added to UserType and left unclassified here. That is
// intentional — an unclassified role must never silently default to GLOBAL.
const ROLE_SCOPE: Record<UserType, ScopeKind> = {
  // Platform-level roles.
  SUPER_ADMIN: "GLOBAL",
  OWNER: "GLOBAL",

  // The franchise boundary. A BRANCH_ADMIN is the salon administrator (Rajesh)
  // and a RECEPTIONIST works one front desk — both are hard-pinned to a branch.
  BRANCH_ADMIN: "BRANCH",
  RECEPTIONIST: "BRANCH",

  // Own records only.
  WORKER: "SELF",
  CUSTOMER: "SELF",

  // UNRESOLVED — these three are global in the current codebase, and Phase 0 must
  // not change the behaviour of any module outside Workers, so they are recorded
  // as GLOBAL to preserve it exactly. None of them appear on a Worker route, so
  // this classification is inert today. Revisit before adopting this helper in
  // Inventory (INVENTORY_MANAGER) and Billing/Reports (ACCOUNTANT), where a
  // per-branch scope is very likely the correct answer.
  INVENTORY_MANAGER: "GLOBAL",
  MARKETING_MANAGER: "GLOBAL",
  ACCOUNTANT: "GLOBAL",
};

export type BranchScope = {
  /** True when the caller may read across every branch. */
  readonly isGlobal: boolean;
  /**
   * The effective branch filter.
   * - BRANCH roles: always their own branch. Never null, never client-controlled.
   * - GLOBAL roles: the optional ?branchId= narrowing filter, or null for "all".
   */
  readonly branchId: string | null;
  readonly userId: string;
  readonly userType: UserType;
};

/**
 * Resolve the caller's branch scope. Call immediately after requireAuth().
 *
 * Pass `url` on list/read routes so GLOBAL roles keep their existing ability to
 * narrow with ?branchId=. Omit it on writes, where the target branch comes from
 * the body via resolveWriteBranchId().
 *
 * Mirrors requireAuth's `{ value, error }` shape so call sites read the same way.
 */
export function requireBranchScope(
  user: AuthUser,
  url?: URL
):
  | { scope: BranchScope; error: null }
  | { scope: null; error: ReturnType<typeof err> } {
  const kind = ROLE_SCOPE[user.userType];

  if (kind === "SELF") {
    // Defence in depth: requireAuth already keeps these roles off admin routes.
    return {
      scope: null,
      error: err("Forbidden — this endpoint is not available for your role", 403),
    };
  }

  if (kind === "BRANCH") {
    // DENY BY DEFAULT. A branch-scoped account with no branch must never fall
    // through to an unfiltered query. (Same fail-safe already used by
    // reception/appointments — generalized here.)
    if (!user.branchId) {
      return {
        scope: null,
        error: err("Your account is not assigned to a branch", 403),
      };
    }
    return {
      // A client-supplied ?branchId= is deliberately ignored, not honoured.
      scope: {
        isGlobal: false,
        branchId: user.branchId,
        userId: user.userId,
        userType: user.userType,
      },
      error: null,
    };
  }

  // GLOBAL — may optionally narrow to one branch.
  const requested = url?.searchParams.get("branchId")?.trim() || null;
  return {
    scope: {
      isGlobal: true,
      branchId: requested,
      userId: user.userId,
      userType: user.userType,
    },
    error: null,
  };
}

/**
 * Prisma `where` fragment for any model that owns a `branchId` column —
 * Appointment, Invoice, Review, Stock, StaffProfile, Offer, PurchaseOrder, …
 *
 *   const where = { ...branchWhere(scope), status: "PENDING" };
 *
 * Returns {} only for a GLOBAL caller who did not narrow. A BRANCH caller always
 * gets a concrete filter.
 */
export function branchWhere(
  scope: BranchScope,
  field = "branchId"
): Record<string, string> {
  return scope.branchId ? { [field]: scope.branchId } : {};
}

/**
 * Guard a single already-loaded record that carries a branchId.
 * Returns an error response when it is out of scope, or null when access is fine.
 *
 *   const invoice = await prisma.invoice.findUnique({ where: { id } });
 *   if (!invoice) return err("Invoice not found", 404);
 *   const denied = denyIfOutOfScope(scope, invoice.branchId);
 *   if (denied) return denied;
 */
export function denyIfOutOfScope(
  scope: BranchScope,
  recordBranchId: string | null | undefined
): ReturnType<typeof err> | null {
  if (scope.isGlobal) return null;
  if (!recordBranchId || recordBranchId !== scope.branchId) {
    return err("Forbidden — record belongs to another branch", 403);
  }
  return null;
}

/**
 * The branch a WRITE should target.
 *
 * A branch-scoped caller ALWAYS writes into their own branch — whatever the body
 * says is ignored, which is what stops a branch admin planting a record in
 * someone else's branch. A global caller supplies it explicitly (may be null
 * where the column is optional).
 */
export function resolveWriteBranchId(
  scope: BranchScope,
  bodyBranchId?: unknown
): string | null {
  if (!scope.isGlobal) return scope.branchId;
  return typeof bodyBranchId === "string" && bodyBranchId.trim()
    ? bodyBranchId.trim()
    : null;
}

// ─── WorkerProfile-specific ──────────────────────────────────────────────────
// WorkerProfile has NO branchId column. A worker's branch lives in the
// WorkerBranch join table, so it cannot use branchWhere()/denyIfOutOfScope().

type Db = Prisma.TransactionClient;

/**
 * Prisma `where` fragment scoping a WorkerProfile query to the caller's branch.
 *
 *   const where: Prisma.WorkerProfileWhereInput = { ...workerBranchWhere(scope) };
 */
export function workerBranchWhere(
  scope: BranchScope
): Prisma.WorkerProfileWhereInput {
  return scope.branchId
    ? { branches: { some: { branchId: scope.branchId, isActive: true } } }
    : {};
}

/**
 * Guard a worker by id. Returns an error response when the worker is outside the
 * caller's branch, or null when access is allowed.
 *
 * Answers 404 (not 403) for an out-of-scope worker, on purpose: a 403 would
 * confirm that a given worker id exists in some other branch, turning this into
 * an existence oracle for enumeration. 404 also matches the "Worker not found"
 * message these routes already return, so no client contract changes.
 */
export async function denyIfWorkerOutOfScope(
  db: Db,
  workerId: string,
  scope: BranchScope
): Promise<ReturnType<typeof err> | null> {
  if (scope.isGlobal) return null;

  const link = await db.workerBranch.findFirst({
    where: { workerId, branchId: scope.branchId!, isActive: true },
    select: { id: true },
  });

  if (!link) return err("Worker not found", 404);
  return null;
}
