// ============================================================================
// MODULE : Customers — shared frontend contracts
//
// Exactly the shapes the API returns. Every field corresponds to one in
// CUSTOMER_SELECT (lib/customer-schema.ts); nothing is invented here.
//
// Dates cross the wire as ISO strings — Prisma `Date`s are JSON-serialised by the
// route — so every timestamp is typed `string`, not `Date`.
// ============================================================================

// The option lists and the age helper are RE-EXPORTED from the server schema
// rather than mirrored: a second copy of the source list is a second thing to
// remember when the Prisma enum changes. lib/customer-schema.ts is safe in a
// client bundle — its only @prisma/client import is type-only.
export {
  CUSTOMER_TYPES,
  CUSTOMER_SOURCES,
  CUSTOMER_GENDERS,
  ageFromDob,
  customerName,
  customerCapabilitiesFor,
  type CustomerCapability,
} from "@/lib/customer-schema";

export type CustomerType = "WALK_IN" | "RETURNING" | "VIP" | "MEMBERSHIP";

export type CustomerSource =
  | "WALK_IN"
  | "REFERENCE"
  | "INSTAGRAM"
  | "FACEBOOK"
  | "GOOGLE"
  | "WEBSITE"
  | "WHATSAPP"
  | "PHONE_CALL"
  | "OTHER";

export type CustomerGender = "MALE" | "FEMALE" | "UNISEX";

export type CustomerMembershipSummary = {
  id: string;
  endDate: string;
  plan: { id: string; name: string; tier: string };
};

export type CustomerRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  alternatePhone: string | null;
  email: string | null;
  gender: CustomerGender | null;
  dateOfBirth: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  customerType: CustomerType;
  entrySource: CustomerSource;
  /** True when a staff member keyed them in rather than self-registration. */
  isManualEntry: boolean;
  createdBy: string | null;
  isActive: boolean;
  /** Non-null once soft-deleted. The row is never removed. */
  deletedAt: string | null;
  totalSpend: number;
  totalVisits: number;
  createdAt: string;
  updatedAt: string;
  branch: { id: string; name: string; code: string } | null;
  memberships: CustomerMembershipSummary[];
  _count: { appointments: number };
};

/** The compact shape /customers/search returns for type-ahead. */
export type CustomerSearchHit = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  totalVisits: number;
  customerType: CustomerType;
  isManualEntry: boolean;
  branch: { id: string; name: string } | null;
  memberships: { plan: { name: string; tier: string } }[];
};

/** What a 409 from POST /customers carries so the dialog can offer a way forward. */
export type DuplicateCustomer = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  totalVisits: number;
  branch: { id: string; name: string } | null;
};

export type BranchOption = { id: string; name: string };

/** "PHONE_CALL" → "Phone Call". */
export function labelise(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

/** "2026-08-03T00:00:00.000Z" → "03 Aug 2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** The date-input value ("YYYY-MM-DD") for a stored ISO timestamp. */
export function dateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function formatCurrency(value: number): string {
  return `₹${Number(value ?? 0).toLocaleString("en-IN")}`;
}
