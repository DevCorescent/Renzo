// ============================================================================
// MODULE : Customers (admin + front desk)
// ROUTE  : /api/v1/admin/customers
//
// METHODS
//   GET  — Paginated, searchable, branch-scoped customer list.
//          ?search= matches name, phone (digits only) or email.
//          ?customerType= ?entrySource= ?entryType=manual|registered
//          ?membership=true ?includeDeleted=true ?sortBy= ?sortOrder=
//   POST — Create a customer manually (the walk-in path).
//          409 + the existing record when the phone is already known, unless
//          `allowDuplicate` is set — which only a platform/branch admin may do.
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN, RECEPTIONIST.
//   Workers are excluded entirely: they may never author or edit a customer.
//
// Branch scoping is `requireBranchScope()`, the same primitive attendance uses, so
// a receptionist sees their own branch's customers plus unassigned (self-
// registered) ones — never another branch's book.
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { created, err, paginated, parsePagination } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { validate, readJson } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import prisma from "@/lib/db";
import {
  CUSTOMER_SELECT,
  CustomerCreateSchema,
  customerCapabilitiesFor,
} from "@/lib/customer-schema";
import {
  buildCustomerWhere,
  createCustomer,
  customerOrderBy,
  parseCustomerFilters,
} from "@/lib/customer-service";

const MODULE = "CUSTOMER";
const ROLES = ["SUPER_ADMIN", "OWNER", "BRANCH_ADMIN", "RECEPTIONIST"] as const;

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;

  const url = new URL(req.url);
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  try {
    const { page, limit, skip } = parsePagination(url);
    const filters = parseCustomerFilters(url);
    const where = buildCustomerWhere(filters, scope);

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: customerOrderBy(filters),
        select: CUSTOMER_SELECT,
      }),
      prisma.customer.count({ where }),
    ]);

    return paginated(items, total, page, limit);
  } catch {
    return err("Internal server error", 500);
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAuth(req, ...ROLES);
  if (error) return error;

  const url = new URL(req.url);
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  const parsed = validate(CustomerCreateSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  const input = parsed.data;
  const caps = customerCapabilitiesFor(user.userType);

  if (!caps.canCreate) {
    return err("Forbidden — your role cannot create customers", 403);
  }

  // Overriding a duplicate is an administrative act. The front desk gets the
  // "already exists" prompt and must open the existing profile instead.
  if (input.allowDuplicate && !caps.canForceDuplicate) {
    return err("Forbidden — only an admin can create a duplicate customer", 403);
  }

  try {
    // A branch-scoped caller stamps their own branch and cannot name another's.
    const branchId = scope.isGlobal ? input.branchId ?? null : scope.branchId;

    if (branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        select: { id: true },
      });
      if (!branch) return err("Validation failed", 422, { branchId: ["Unknown branch"] });
    }

    const result = await createCustomer({
      input,
      createdByUserId: user.userId,
      branchId,
      isManualEntry: true,
    });

    if (!result.ok) {
      // The duplicate case carries the matched record in `data` so the dialog can
      // offer "open profile" / "book appointment" rather than a dead end. Built
      // inline because the shared err() helper has no slot for a payload, and
      // widening its signature would touch every route in the project.
      if (result.conflict === "DUPLICATE") {
        return NextResponse.json(
          { success: false, message: result.message, data: { existing: result.existing } },
          { status: 409 }
        );
      }
      return err(result.message, 409);
    }

    await writeAudit(user, {
      action: "CREATE",
      module: MODULE,
      refId: result.customer.id,
      refType: "Customer",
      newValue: {
        name: `${result.customer.firstName} ${result.customer.lastName ?? ""}`.trim(),
        phone: result.customer.phone,
        branchId,
        customerType: result.customer.customerType,
        entrySource: result.customer.entrySource,
        isManualEntry: true,
      },
    });

    return created(result.customer, "Customer created");
  } catch {
    return err("Internal server error", 500);
  }
}
