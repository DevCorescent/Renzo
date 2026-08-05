// ============================================================================
// MODULE : Customers (admin + front desk)
// ROUTE  : /api/v1/admin/customers/:id
//
// METHODS
//   GET    — One customer, with their branch, live membership and visit count.
//   PATCH  — Edit customer details.
//   DELETE — SOFT delete only. Sets deletedAt/deletedBy and isActive=false; the
//            row itself is never removed, because invoices, appointments and
//            loyalty history all point at it and must survive.
//
// ACCESS
//   GET/PATCH — SUPER_ADMIN, OWNER, BRANCH_ADMIN, RECEPTIONIST
//   DELETE    — SUPER_ADMIN, OWNER, BRANCH_ADMIN (never the front desk)
//   Workers have no access to any of it.
//
// Every mutation writes an AuditLog carrying the previous and the new values.
// ============================================================================

import { NextRequest } from "next/server";
import { err, ok } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { validate, readJson } from "@/lib/validate";
import { writeAudit } from "@/lib/audit";
import prisma from "@/lib/db";
import {
  CUSTOMER_SELECT,
  CustomerUpdateSchema,
  customerCapabilitiesFor,
} from "@/lib/customer-schema";
import {
  buildCustomerUpdate,
  emailTaken,
  findDuplicateByPhone,
} from "@/lib/customer-service";

const MODULE = "CUSTOMER";
const READ_WRITE_ROLES = ["SUPER_ADMIN", "OWNER", "BRANCH_ADMIN", "RECEPTIONIST"] as const;
const DELETE_ROLES = ["SUPER_ADMIN", "OWNER", "BRANCH_ADMIN"] as const;

/** The audit snapshot. Narrow on purpose: a diff of the fields a human can change. */
const AUDIT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  alternatePhone: true,
  email: true,
  gender: true,
  dateOfBirth: true,
  address: true,
  city: true,
  state: true,
  pincode: true,
  branchId: true,
  customerType: true,
  entrySource: true,
  isActive: true,
  deletedAt: true,
} as const;

/**
 * Load a customer the caller is allowed to see.
 *
 * A branch-scoped role may reach their own branch's customers and unassigned ones;
 * anything else answers 404 rather than 403, so the existence of another branch's
 * customer is not disclosed.
 */
async function loadInScope(id: string, branchId: string | null) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { ...AUDIT_SELECT, userId: true },
  });
  if (!customer) return null;
  if (branchId && customer.branchId !== null && customer.branchId !== branchId) return null;
  return customer;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, ...READ_WRITE_ROLES);
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  try {
    const { id } = await params;

    const guard = await loadInScope(id, scope.isGlobal ? null : scope.branchId);
    if (!guard) return err("Customer not found", 404);

    // The DETAIL view carries recent appointments; the list deliberately does not,
    // because that join across a 25-row page is the expensive part of this query.
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        ...CUSTOMER_SELECT,
        appointments: {
          orderBy: { appointmentDate: "desc" },
          take: 10,
          select: {
            id: true,
            appointmentNo: true,
            appointmentDate: true,
            startTime: true,
            status: true,
            totalAmount: true,
            branch: { select: { name: true } },
          },
        },
      },
    });
    if (!customer) return err("Customer not found", 404);

    return ok(customer);
  } catch {
    return err("Internal server error", 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, ...READ_WRITE_ROLES);
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  if (!customerCapabilitiesFor(user.userType).canEdit) {
    return err("Forbidden — your role cannot edit customers", 403);
  }

  const parsed = validate(CustomerUpdateSchema, await readJson(req));
  if (parsed.error) return parsed.error;

  const input = parsed.data;

  try {
    const { id } = await params;

    const existing = await loadInScope(id, scope.isGlobal ? null : scope.branchId);
    if (!existing) return err("Customer not found", 404);

    if (existing.deletedAt) {
      return err("This customer has been deleted and cannot be edited", 409);
    }

    // Changing a phone must not collide with another live customer.
    if (input.phone && input.phone !== existing.phone) {
      const clash = await findDuplicateByPhone(prisma, input.phone, id);
      if (clash) {
        return err("Validation failed", 422, {
          phone: ["Another customer already uses this phone number"],
        });
      }
    }

    if (input.email && input.email !== existing.email) {
      if (await emailTaken(prisma, input.email, existing.userId)) {
        return err("Validation failed", 422, {
          email: ["This email is already registered"],
        });
      }
    }

    // Only a platform role may move a customer between branches.
    const data = buildCustomerUpdate(scope.isGlobal ? input : { ...input, branchId: undefined });

    const customer = await prisma.customer.update({
      where: { id },
      data,
      select: CUSTOMER_SELECT,
    });

    // Keep the sign-in account in step: it is the row that owns phone/email
    // uniqueness, and letting the two drift breaks the customer's own login.
    if (input.phone !== undefined || input.email !== undefined) {
      await prisma.user
        .update({
          where: { id: existing.userId },
          data: {
            ...(input.phone !== undefined ? { phone: input.phone } : {}),
            ...(input.email !== undefined ? { email: input.email } : {}),
          },
        })
        .catch(() => {
          // A unique clash here is already reported above; never fail the profile
          // update because the mirrored account column could not be touched.
        });
    }

    await writeAudit(user, {
      action: "UPDATE",
      module: MODULE,
      refId: id,
      refType: "Customer",
      oldValue: JSON.parse(JSON.stringify(existing)),
      newValue: JSON.parse(JSON.stringify(data)),
    });

    return ok(customer, "Customer updated");
  } catch {
    return err("Internal server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth(req, ...DELETE_ROLES);
  if (error) return error;

  const { scope, error: scopeError } = requireBranchScope(user);
  if (scopeError) return scopeError;

  if (!customerCapabilitiesFor(user.userType).canDelete) {
    return err("Forbidden — your role cannot delete customers", 403);
  }

  try {
    const { id } = await params;

    const existing = await loadInScope(id, scope.isGlobal ? null : scope.branchId);
    if (!existing) return err("Customer not found", 404);
    if (existing.deletedAt) return err("This customer is already deleted", 409);

    // SOFT delete. `prisma.customer.delete` is deliberately never called here:
    // appointments, invoices and loyalty rows reference this id, and removing it
    // would either fail on the foreign keys or orphan financial history.
    const customer = await prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: user.userId, isActive: false },
      select: CUSTOMER_SELECT,
    });

    await writeAudit(user, {
      action: "DELETE",
      module: MODULE,
      refId: id,
      refType: "Customer",
      oldValue: JSON.parse(JSON.stringify(existing)),
      newValue: { deletedAt: customer.deletedAt, deletedBy: user.userId, isActive: false },
    });

    return ok({ id }, "Customer deleted");
  } catch {
    return err("Internal server error", 500);
  }
}
