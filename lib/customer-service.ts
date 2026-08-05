// ============================================================================
// MODULE : Customers — shared service layer
//
// THE customer write path. A walk-in typed in at the front desk, a customer
// created on the fly while booking an appointment, and a row imported from a CSV
// all land HERE, so all three produce the same shape: a User with userType
// CUSTOMER plus its Customer profile, correctly flagged and attributed.
//
// WHY A USER IS ALWAYS CREATED
// ----------------------------
// Customer.userId is a REQUIRED unique FK in the existing schema — a customer
// cannot exist without an account row. Rather than change that (which would ripple
// through wallet, loyalty, memberships and reviews), a walk-in gets a User with a
// phone and NO password and NO email verification. They can never sign in until
// they set a password, which is exactly right for someone who walked through the
// door and gave a phone number.
//
// Pure Prisma against the existing models — no new tables, no second customer
// concept, no ORM change.
// ============================================================================

import type { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { branchWhere, type BranchScope } from "@/lib/branch-scope";
import {
  CUSTOMER_SELECT,
  type CustomerCreateInput,
  type CustomerRecord,
} from "@/lib/customer-schema";

type Db = Prisma.TransactionClient | typeof prisma;

// ============================================================================
// NORMALISATION
// ============================================================================

/**
 * Reduce a phone to the form duplicate detection compares on.
 *
 * "+91 98765 43210", "098765 43210" and "9876543210" are one person. Storing the
 * raw string but MATCHING on the last 10 digits is what makes the front desk's
 * "already exists" prompt actually fire, instead of quietly creating a third copy
 * of a regular customer because someone typed the country code this time.
 */
export function phoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** Split a typed full name into the model's two columns. */
export function splitName(full: string): { firstName: string; lastName: string | null } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "Walk-in",
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : null,
  };
}

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

export type DuplicateMatch = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  totalVisits: number;
  branch: { id: string; name: string } | null;
};

/**
 * Find an existing customer with this phone number.
 *
 * Deliberately searches ACROSS branches even for a branch-scoped caller: a regular
 * at the Bandra branch walking into Andheri is the same person, and silently
 * creating a second profile would split their visit history, wallet and loyalty
 * points in two.
 */
export async function findDuplicateByPhone(
  db: Db,
  phone: string,
  excludeCustomerId?: string
): Promise<DuplicateMatch | null> {
  const key = phoneKey(phone);
  if (!key) return null;

  // `endsWith` on the normalised tail catches every stored formatting variant.
  const match = await db.customer.findFirst({
    where: {
      deletedAt: null,
      phone: { endsWith: key },
      ...(excludeCustomerId ? { id: { not: excludeCustomerId } } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      totalVisits: true,
      branch: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return match;
}

/** True when this email already belongs to another account. */
export async function emailTaken(
  db: Db,
  email: string,
  excludeUserId?: string
): Promise<boolean> {
  const existing = await db.user.findFirst({
    where: {
      email: email.toLowerCase(),
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });
  return existing !== null;
}

// ============================================================================
// CREATE
// ============================================================================

export type CreateCustomerResult =
  | { ok: true; customer: CustomerRecord; reusedExisting: boolean }
  | { ok: false; conflict: "PHONE_TAKEN_BY_STAFF" | "EMAIL_TAKEN"; message: string }
  | { ok: false; conflict: "DUPLICATE"; message: string; existing: DuplicateMatch };

/**
 * Create a customer, or report the duplicate that stops us.
 *
 * `allowDuplicate` is the admin override for two people genuinely sharing a phone.
 * Without it, a matching phone returns the existing record so the caller can offer
 * "open profile / book appointment" instead of creating a twin.
 */
export async function createCustomer(params: {
  input: CustomerCreateInput;
  createdByUserId: string;
  /** Null for a platform role creating an unassigned customer. */
  branchId: string | null;
  isManualEntry: boolean;
}): Promise<CreateCustomerResult> {
  const { input, createdByUserId, branchId, isManualEntry } = params;

  const duplicate = await findDuplicateByPhone(prisma, input.phone);
  if (duplicate && !input.allowDuplicate) {
    return {
      ok: false,
      conflict: "DUPLICATE",
      message: "A customer with this phone number already exists",
      existing: duplicate,
    };
  }

  // The phone may belong to a STAFF account, which is a hard stop rather than a
  // duplicate — we must never attach a customer profile to an employee's login.
  const phoneOwner = await prisma.user.findFirst({
    where: { phone: input.phone },
    select: { id: true, userType: true, customerProfile: { select: { id: true } } },
  });
  if (phoneOwner && phoneOwner.userType !== "CUSTOMER") {
    return {
      ok: false,
      conflict: "PHONE_TAKEN_BY_STAFF",
      message: "This phone number belongs to a staff account",
    };
  }

  if (input.email && (await emailTaken(prisma, input.email))) {
    return { ok: false, conflict: "EMAIL_TAKEN", message: "This email is already registered" };
  }

  // A CUSTOMER User already owning this phone (the allowDuplicate path, or a
  // half-created account) cannot take a second phone-unique row, so the new
  // profile hangs off a fresh User with no phone rather than failing the insert.
  const phoneIsFree = phoneOwner === null;

  const customer = await prisma.customer.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName ?? null,
      phone: input.phone,
      alternatePhone: input.alternatePhone ?? null,
      email: input.email ?? null,
      gender: input.gender ?? null,
      dateOfBirth: input.dateOfBirth ? new Date(`${input.dateOfBirth}T00:00:00.000Z`) : null,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      pincode: input.pincode ?? null,
      customerType: input.customerType ?? "WALK_IN",
      entrySource: input.entrySource ?? "WALK_IN",
      isManualEntry,
      createdBy: createdByUserId,
      // `connect`, not a bare branchId: nesting the User create forces Prisma's
      // checked-create variant, in which every relation must be nested too.
      ...(branchId ? { branch: { connect: { id: branchId } } } : {}),
      user: {
        create: {
          // Walk-ins are unverified by design: no email confirmation, no password.
          userType: "CUSTOMER",
          isVerified: false,
          ...(phoneIsFree ? { phone: input.phone } : {}),
          ...(input.email && phoneIsFree ? { email: input.email } : {}),
        },
      },
    },
    select: CUSTOMER_SELECT,
  });

  return { ok: true, customer, reusedExisting: false };
}

// ============================================================================
// BOOKING BRIDGE
// ============================================================================

/**
 * Resolve the customer for a walk-in booking, creating one if the phone is new.
 *
 * This is the function the reception appointment route calls. It exists so that a
 * customer born from a booking is flagged, attributed and branch-stamped exactly
 * like one typed into the walk-in dialog — before this, the booking route created
 * a bare profile inline and those rows were indistinguishable from self-registered
 * ones in every report.
 *
 * Returns the customerId, or a reason the booking cannot proceed.
 */
export async function resolveCustomerForBooking(params: {
  db: Db;
  phone: string;
  name: string;
  branchId: string;
  createdByUserId: string;
}): Promise<{ ok: true; customerId: string } | { ok: false; message: string }> {
  const { db, phone, name, branchId, createdByUserId } = params;

  const account = await db.user.findFirst({
    where: { phone },
    select: { id: true, userType: true, customerProfile: { select: { id: true } } },
  });

  if (account?.customerProfile) {
    return { ok: true, customerId: account.customerProfile.id };
  }
  if (account) {
    return { ok: false, message: "This phone number belongs to a non-customer account" };
  }

  const { firstName, lastName } = splitName(name);

  const createdCustomer = await db.user.create({
    data: {
      phone,
      userType: "CUSTOMER",
      isVerified: false,
      customerProfile: {
        create: {
          firstName,
          lastName,
          phone,
          branchId,
          customerType: "WALK_IN",
          entrySource: "WALK_IN",
          isManualEntry: true,
          createdBy: createdByUserId,
        },
      },
    },
    select: { customerProfile: { select: { id: true } } },
  });

  return { ok: true, customerId: createdCustomer.customerProfile!.id };
}

// ============================================================================
// QUERY
// ============================================================================

export type CustomerFilters = {
  search: string | null;
  customerType: string | null;
  entrySource: string | null;
  manualOnly: boolean | null;
  includeDeleted: boolean;
  membershipOnly: boolean;
  sortBy: string;
  sortOrder: Prisma.SortOrder;
};

const SORTABLE = new Set(["createdAt", "firstName", "totalSpend", "totalVisits"]);

export function parseCustomerFilters(url: URL): CustomerFilters {
  const params = url.searchParams;
  const sortByRaw = params.get("sortBy")?.trim() ?? "createdAt";
  const entryRaw = params.get("entryType")?.trim().toLowerCase() ?? "";

  return {
    search: params.get("search")?.trim() || null,
    customerType: params.get("customerType")?.trim() || null,
    entrySource: params.get("entrySource")?.trim() || null,
    manualOnly: entryRaw === "manual" ? true : entryRaw === "registered" ? false : null,
    includeDeleted: params.get("includeDeleted") === "true",
    membershipOnly: params.get("membership") === "true",
    sortBy: SORTABLE.has(sortByRaw) ? sortByRaw : "createdAt",
    sortOrder: params.get("sortOrder")?.toLowerCase() === "asc" ? "asc" : "desc",
  };
}

/**
 * Compose filters + branch scope into a where clause.
 *
 * Branch isolation comes from `branchWhere(scope)` and nothing else, so a branch
 * admin cannot widen their view with a query param. Customers with NO branch
 * (self-registered online) stay visible to a branch role — they belong to the
 * salon, and hiding them would make the front desk create duplicates.
 */
export function buildCustomerWhere(
  filters: CustomerFilters,
  scope: BranchScope
): Prisma.CustomerWhereInput {
  const branch = branchWhere(scope) as { branchId?: string };

  const search = filters.search;

  return {
    ...(filters.includeDeleted ? {} : { deletedAt: null }),
    ...(branch.branchId
      ? { OR: [{ branchId: branch.branchId }, { branchId: null }] }
      : {}),
    ...(filters.customerType
      ? { customerType: filters.customerType as Prisma.EnumCustomerTypeFilter["equals"] }
      : {}),
    ...(filters.entrySource
      ? { entrySource: filters.entrySource as Prisma.EnumCustomerSourceFilter["equals"] }
      : {}),
    ...(filters.manualOnly !== null ? { isManualEntry: filters.manualOnly } : {}),
    ...(filters.membershipOnly ? { memberships: { some: { status: "ACTIVE" } } } : {}),
    ...(search
      ? {
          AND: [
            {
              OR: [
                { firstName: { contains: search, mode: "insensitive" as const } },
                { lastName: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
                // Digits only, so "98765 43210" finds "+919876543210".
                { phone: { contains: phoneKey(search) || search } },
              ],
            },
          ],
        }
      : {}),
  };
}

export function customerOrderBy(
  filters: CustomerFilters
): Prisma.CustomerOrderByWithRelationInput[] {
  return [{ [filters.sortBy]: filters.sortOrder }, { id: "asc" }];
}

// ============================================================================
// UPDATE HELPERS
// ============================================================================

/** Map a validated update payload onto Customer columns, skipping absent keys. */
export function buildCustomerUpdate(
  input: Partial<CustomerCreateInput>
): Prisma.CustomerUpdateInput {
  const set = <K extends string, V>(key: K, value: V | undefined) =>
    value === undefined ? {} : { [key]: value };

  return {
    ...set("firstName", input.firstName),
    ...set("lastName", input.lastName ?? undefined),
    ...set("phone", input.phone),
    ...set("alternatePhone", input.alternatePhone),
    ...set("email", input.email),
    ...set("gender", input.gender),
    ...(input.dateOfBirth === undefined
      ? {}
      : {
          dateOfBirth: input.dateOfBirth
            ? new Date(`${input.dateOfBirth}T00:00:00.000Z`)
            : null,
        }),
    ...set("address", input.address),
    ...set("city", input.city),
    ...set("state", input.state),
    ...set("pincode", input.pincode),
    ...set("customerType", input.customerType),
    ...set("entrySource", input.entrySource),
    ...(input.branchId === undefined ? {} : { branchId: input.branchId }),
  } as Prisma.CustomerUpdateInput;
}
