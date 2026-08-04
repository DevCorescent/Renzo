// ============================================================================
// MODULE : Customers — shared validation and select shapes
//
// Lives in lib/ rather than being exported from a route: a Next.js `route.ts` may
// only export HTTP method handlers, so sharing a schema between /admin/customers
// and /admin/customers/[id] through one of them is not possible. Mirrors the
// arrangement lib/shift-schema.ts already uses.
// ============================================================================

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { UserType } from "@/types/api";

// ============================================================================
// CAPABILITIES
//
// What each role may DO to a customer. Lives here, beside the schema, because two
// different callers need the same answer: the API (to ENFORCE it) and the server
// pages (to decide which buttons to render). One table means the buttons a role
// sees can never drift from what the API will permit.
// ============================================================================

export type CustomerCapability = {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canImportExport: boolean;
  /** Deliberately create a second record on a phone that already exists. */
  canForceDuplicate: boolean;
  /** Assign a customer to a branch other than the caller's own. */
  canChooseBranch: boolean;
};

const NO_CUSTOMER_ACCESS: CustomerCapability = {
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canImportExport: false,
  canForceDuplicate: false,
  canChooseBranch: false,
};

/**
 * Exhaustive by construction — `Record<UserType, …>` fails the build if a role is
 * added and left unclassified, so a new role can never silently inherit the right
 * to delete customers.
 */
const ROLE_CUSTOMER_CAPABILITIES: Record<UserType, CustomerCapability> = {
  SUPER_ADMIN: {
    canCreate: true, canEdit: true, canDelete: true,
    canImportExport: true, canForceDuplicate: true, canChooseBranch: true,
  },
  OWNER: {
    canCreate: true, canEdit: true, canDelete: true,
    canImportExport: true, canForceDuplicate: true, canChooseBranch: true,
  },
  BRANCH_ADMIN: {
    canCreate: true, canEdit: true, canDelete: true,
    canImportExport: true, canForceDuplicate: true,
    // Pinned to their own branch by requireBranchScope; the picker would be a lie.
    canChooseBranch: false,
  },
  RECEPTIONIST: {
    // The front desk creates and corrects customers all day. It does not delete
    // them, extract the customer book, or force a duplicate past the warning.
    canCreate: true, canEdit: true, canDelete: false,
    canImportExport: false, canForceDuplicate: false, canChooseBranch: false,
  },
  // A worker serves customers; they never author or edit the customer record.
  WORKER: NO_CUSTOMER_ACCESS,
  CUSTOMER: NO_CUSTOMER_ACCESS,
  INVENTORY_MANAGER: NO_CUSTOMER_ACCESS,
  MARKETING_MANAGER: NO_CUSTOMER_ACCESS,
  ACCOUNTANT: NO_CUSTOMER_ACCESS,
};

export function customerCapabilitiesFor(userType: UserType): CustomerCapability {
  return ROLE_CUSTOMER_CAPABILITIES[userType];
}

/**
 * Same rule the worker forms use (lib/worker-form-schema.ts) — 10–15 digits with
 * an optional +. Deliberately NOT stricter: the salon takes international
 * customers and landline callers, and a front desk blocked by a regex will simply
 * type a fake number to get past it.
 */
export const PHONE_RE = /^\+?\d{10,15}$/;

const PhoneField = z
  .string()
  .trim()
  .regex(PHONE_RE, "Phone must be 10–15 digits, optionally prefixed with +");

const OptionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const CUSTOMER_TYPES = ["WALK_IN", "RETURNING", "VIP", "MEMBERSHIP"] as const;
export const CUSTOMER_SOURCES = [
  "WALK_IN",
  "REFERENCE",
  "INSTAGRAM",
  "FACEBOOK",
  "GOOGLE",
  "WEBSITE",
  "WHATSAPP",
  "PHONE_CALL",
  "OTHER",
] as const;

/** Gender is the EXISTING Prisma enum — not re-declared, so services and customers agree. */
export const CUSTOMER_GENDERS = ["MALE", "FEMALE", "UNISEX"] as const;

const DateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
  .nullable()
  .optional();

/**
 * A manually entered customer.
 *
 * Only NAME and PHONE are required. That is the whole design: the front desk must
 * be able to create a bookable customer in seconds while someone waits, and every
 * other field is something the salon can fill in later from the profile page.
 */
export const CustomerCreateSchema = z.object({
  firstName: z.string().trim().min(1, "Customer name is required").max(60),
  lastName: OptionalText(60),
  phone: PhoneField,
  alternatePhone: PhoneField.nullable().optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email").nullable().optional(),
  gender: z.enum(CUSTOMER_GENDERS).nullable().optional(),
  dateOfBirth: DateOnly,
  address: OptionalText(300),
  city: OptionalText(80),
  state: OptionalText(80),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Pincode must be 6 digits")
    .nullable()
    .optional(),
  branchId: z.string().trim().min(1).nullable().optional(),
  customerType: z.enum(CUSTOMER_TYPES).optional(),
  entrySource: z.enum(CUSTOMER_SOURCES).optional(),
  notes: OptionalText(500),
  /**
   * Create a second record even though the phone already belongs to someone.
   * Admin-only escape hatch for the genuine case of two people sharing a number
   * (a couple, a parent booking for a child).
   */
  allowDuplicate: z.boolean().optional(),
});

export type CustomerCreateInput = z.infer<typeof CustomerCreateSchema>;

/** Every field is optional on update; absent means "leave alone". */
export const CustomerUpdateSchema = CustomerCreateSchema.partial().omit({
  allowDuplicate: true,
});

export type CustomerUpdateInput = z.infer<typeof CustomerUpdateSchema>;

/**
 * The projection every customer list, profile and export reads.
 *
 * Explicit rather than `include: true` so a column added to Customer cannot leak
 * into an export by accident — the same rule ATTENDANCE_SELECT follows.
 */
export const CUSTOMER_SELECT = {
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
  customerType: true,
  entrySource: true,
  isManualEntry: true,
  createdBy: true,
  isActive: true,
  deletedAt: true,
  totalSpend: true,
  totalVisits: true,
  createdAt: true,
  updatedAt: true,
  branch: { select: { id: true, name: true, code: true } },
  // Only the live membership, and only one: the list shows a tier pill, not a
  // history. The profile page loads the full record separately.
  memberships: {
    where: { status: "ACTIVE" as const },
    take: 1,
    orderBy: { endDate: "desc" as const },
    select: {
      id: true,
      endDate: true,
      plan: { select: { id: true, name: true, tier: true } },
    },
  },
  _count: { select: { appointments: true } },
} satisfies Prisma.CustomerSelect;

export type CustomerRecord = Prisma.CustomerGetPayload<{
  select: typeof CUSTOMER_SELECT;
}>;

/** Display name, with the same fallback the booking screens already use. */
export function customerName(c: { firstName: string; lastName?: string | null }): string {
  return `${c.firstName} ${c.lastName ?? ""}`.trim();
}

/**
 * Age from a date of birth, or null when unknown.
 *
 * Computed rather than stored: an age column is wrong the day after it is written,
 * and the form shows it as a derived hint beside the DOB field.
 */
export function ageFromDob(dob: Date | string | null | undefined): number | null {
  if (!dob) return null;
  const d = typeof dob === "string" ? new Date(dob) : dob;
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - d.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < d.getUTCDate())) age -= 1;

  return age >= 0 && age < 130 ? age : null;
}
