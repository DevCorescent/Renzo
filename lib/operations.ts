// ============================================================================
// MODULE : Manual Operations — shared contracts and capabilities
//
// The manual-operations module is an ALTERNATIVE ENTRY POINT, not a second
// system. Nearly every action it exposes already had a route: billing, payments,
// coupons, gift cards, inventory adjustments, appointment status, refunds, staff
// assignment. Those are reused as-is; this file only holds what the front desk
// needs that did not exist anywhere — the capability table, the operation
// catalogue that drives the hub, and the shared shapes.
//
// Nothing here talks to Prisma. lib/operations-service.ts is the data-facing half.
// ============================================================================

import type { UserType } from "@/types/api";

// ============================================================================
// CAPABILITIES
// ============================================================================

export type OperationsCapability = {
  /** May reach the manual-operations hub at all. */
  canAccess: boolean;
  canCreateCustomer: boolean;
  canBookAppointment: boolean;
  canBill: boolean;
  canTakePayment: boolean;
  canSellMembership: boolean;
  /**
   * Raise a MANUAL bill — an invoice with no appointment (products, a
   * consultation, a sundry charge). A "product sale" and a "blank bill" are the
   * same operation, so there is one flag for both.
   *
   * THE VALUE IN THIS TABLE IS ONLY A DEFAULT. The authority is
   * `billingCapabilitiesFor()` in lib/billing-service.ts, because a branch can
   * opt its front desk in via `BranchSetting.allowReceptionBlankBill` — and a
   * static table cannot express a per-branch setting. `OperationsPage` resolves
   * the real value and overrides this before anything is rendered.
   *
   * Two tables that could disagree is exactly the bug this comment exists to
   * prevent: the page used to open for a receptionist while the API refused the
   * submit, which read to the user as "manual billing is broken".
   */
  canManualBill: boolean;
  canAdjustInventory: boolean;
  canMarkAttendance: boolean;
  canManageStaff: boolean;
  /**
   * Author gift cards / coupons. Distinct from REDEEMING one at billing, which
   * reception does every day — that lives inside the billing screen, not here.
   * Gated to platform roles because the catalogue pages live under /marketing,
   * which proxy.ts admits for SUPER_ADMIN, OWNER and MARKETING_MANAGER only.
   */
  canIssueGiftCard: boolean;
  canApplyCoupon: boolean;
  /** Expenses and refunds move money OUT; the front desk records neither. */
  canRecordExpense: boolean;
  canRefund: boolean;
  /** Hand-editing a customer's points is a supervisory act. */
  canAdjustLoyalty: boolean;
  /** Discounts above the branch limit need someone senior. */
  canOverrideDiscountLimit: boolean;
};

const NO_OPS: OperationsCapability = {
  canAccess: false,
  canCreateCustomer: false,
  canBookAppointment: false,
  canBill: false,
  canTakePayment: false,
  canSellMembership: false,
  canManualBill: false,
  canAdjustInventory: false,
  canMarkAttendance: false,
  canManageStaff: false,
  canIssueGiftCard: false,
  canApplyCoupon: false,
  canRecordExpense: false,
  canRefund: false,
  canAdjustLoyalty: false,
  canOverrideDiscountLimit: false,
};

const ALL_OPS: OperationsCapability = {
  canAccess: true,
  canCreateCustomer: true,
  canBookAppointment: true,
  canBill: true,
  canTakePayment: true,
  canSellMembership: true,
  canManualBill: true,
  canAdjustInventory: true,
  canMarkAttendance: true,
  canManageStaff: true,
  canIssueGiftCard: true,
  canApplyCoupon: true,
  canRecordExpense: true,
  canRefund: true,
  canAdjustLoyalty: true,
  canOverrideDiscountLimit: true,
};

/**
 * Exhaustive by construction — `Record<UserType, …>` fails the build if a role is
 * added and left unclassified, so a new role can never silently inherit the right
 * to refund money.
 */
const ROLE_OPERATIONS: Record<UserType, OperationsCapability> = {
  SUPER_ADMIN: ALL_OPS,
  OWNER: ALL_OPS,
  // Runs one branch end to end. requireBranchScope() pins the DATA; these flags
  // only decide which operations are offered.
  BRANCH_ADMIN: {
    ...ALL_OPS,
    // The gift-card and coupon catalogues live under /marketing, which proxy.ts
    // does not admit a BRANCH_ADMIN to. Offering the card would send them to
    // /unauthorized, so it is not offered — they still REDEEM both at billing.
    canIssueGiftCard: false,
    canApplyCoupon: false,
  },
  RECEPTIONIST: {
    canAccess: true,
    canCreateCustomer: true,
    canBookAppointment: true,
    canBill: true,
    canTakePayment: true,
    canSellMembership: true,
    canManualBill: true,
    canMarkAttendance: true,
    // The front desk serves customers; it does not author gift cards or coupons,
    // correct stock counts, hire staff, record what the branch spent, reverse a
    // payment, or edit loyalty points.
    canIssueGiftCard: false,
    canApplyCoupon: false,
    canAdjustInventory: false,
    canManageStaff: false,
    canRecordExpense: false,
    canRefund: false,
    canAdjustLoyalty: false,
    canOverrideDiscountLimit: false,
  },
  // A worker performs services. They never administer the business manually.
  WORKER: NO_OPS,
  CUSTOMER: NO_OPS,
  INVENTORY_MANAGER: NO_OPS,
  MARKETING_MANAGER: NO_OPS,
  ACCOUNTANT: NO_OPS,
};

export function operationsCapabilitiesFor(userType: UserType): OperationsCapability {
  return ROLE_OPERATIONS[userType];
}

// ============================================================================
// THE OPERATION CATALOGUE
//
// One list drives the hub for every role. Each entry names the capability that
// gates it and the EXISTING surface it opens — which is the whole point: the hub
// is a directory of the system's real workflows, not a parallel set of them.
// ============================================================================

export type OperationKey =
  | "customer"
  | "appointment"
  | "walkIn"
  | "billing"
  | "payment"
  | "productSale"
  | "membership"
  | "giftCard"
  | "coupon"
  | "refund"
  | "expense"
  | "loyalty"
  | "attendance"
  | "staff"
  | "staffAssignment"
  | "inventory"
  | "health"
  | "serviceOrder"
  | "advanceBooking";

export type OperationGroup = "Front desk" | "Money" | "People" | "Stock";

type OperationBase = {
  key: OperationKey;
  label: string;
  description: string;
  group: OperationGroup;
  /** Which capability must be true for this card to appear. */
  requires: keyof OperationsCapability;
};

/**
 * Exactly one of the two href forms, enforced by the type:
 *   `href`         — relative to the role's own prefix ("customers"), so one
 *                    catalogue serves reception, branch admin and super admin
 *                    without any of them hardcoding another's URLs.
 *   `absoluteHref` — a fixed path, for operations that live outside the prefix.
 *
 * Setting both, or neither, fails the build rather than producing a dead card.
 */
export type OperationDef = OperationBase &
  ({ href: string; absoluteHref?: never } | { href?: never; absoluteHref: string });

/** The URL a card opens for a given role. */
export function operationHref(op: OperationDef, basePath: string): string {
  return op.absoluteHref ?? `${basePath}/${op.href}`;
}

export const OPERATIONS: OperationDef[] = [
  {
    key: "customer",
    label: "Manual Customer",
    description: "Add a walk-in, returning or guest customer in seconds.",
    group: "Front desk",
    requires: "canCreateCustomer",
    href: "customers",
  },
  {
    key: "walkIn",
    label: "Walk-In Console",
    description: "Customer → booking → service → bill → payment → invoice, on one screen.",
    group: "Front desk",
    requires: "canBookAppointment",
    href: "walk-in",
  },
  {
    key: "appointment",
    label: "Manual Appointment",
    description: "Book without a customer login. Conflicts still checked.",
    group: "Front desk",
    requires: "canBookAppointment",
    absoluteHref: "/reception/booking/new",
  },
  {
    key: "advanceBooking",
    label: "Advance Booking",
    description: "Book a future date and take an advance payment.",
    group: "Front desk",
    requires: "canBookAppointment",
    absoluteHref: "/reception/booking/new",
  },
  {
    key: "serviceOrder",
    label: "Service Order",
    description: "Today's board — assign, start and complete service orders.",
    group: "Front desk",
    requires: "canBookAppointment",
    absoluteHref: "/reception/queue",
  },
  {
    key: "staffAssignment",
    label: "Staff Assignment",
    description: "Assign a stylist, chair or room to a booking.",
    group: "Front desk",
    requires: "canBookAppointment",
    absoluteHref: "/reception/calendar",
  },

  {
    key: "billing",
    label: "Manual Billing",
    description: "Raise an invoice: services, products, discount, tax and tips.",
    group: "Money",
    requires: "canBill",
    href: "billing",
  },
  {
    key: "productSale",
    label: "Manual Bill",
    description:
      "Bill products, services or a custom charge with no appointment. Stock and tax follow the branch.",
    group: "Money",
    requires: "canManualBill",
    href: "sale",
  },
  {
    key: "payment",
    label: "Manual Payment",
    description: "Cash, card, UPI, wallet, gift card — full, partial or split.",
    group: "Money",
    requires: "canTakePayment",
    href: "billing",
  },
  {
    key: "membership",
    label: "Sell Membership",
    description: "Sell and activate a plan immediately, benefits applied at once.",
    group: "Money",
    requires: "canSellMembership",
    href: "membership",
  },
  {
    key: "giftCard",
    label: "Gift Cards",
    description: "Issue, recharge, redeem or expire a gift card.",
    group: "Money",
    requires: "canIssueGiftCard",
    absoluteHref: "/marketing/gift-cards",
  },
  {
    key: "coupon",
    label: "Coupons",
    description: "Apply a coupon by hand and track its usage.",
    group: "Money",
    requires: "canApplyCoupon",
    absoluteHref: "/marketing/coupons",
  },
  {
    key: "refund",
    label: "Manual Refund",
    description: "Reverse an invoice, product or membership. Reason required.",
    group: "Money",
    requires: "canRefund",
    absoluteHref: "/accountant/invoices",
  },
  {
    key: "expense",
    label: "Branch Expense",
    description: "Record rent, electricity, pantry, maintenance and the rest.",
    group: "Money",
    requires: "canRecordExpense",
    href: "expenses",
  },
  {
    key: "loyalty",
    label: "Loyalty Adjustment",
    description: "Add or deduct points by hand. Reason mandatory, always audited.",
    group: "Money",
    requires: "canAdjustLoyalty",
    href: "loyalty",
  },

  {
    key: "attendance",
    label: "Manual Attendance",
    description: "Mark, correct, approve and override attendance.",
    group: "People",
    requires: "canMarkAttendance",
    href: "attendance",
  },
  {
    key: "staff",
    label: "Staff Management",
    description: "Create, edit, transfer, assign shifts, services and branches.",
    group: "People",
    requires: "canManageStaff",
    href: "workers",
  },

  {
    key: "health",
    label: "System Health",
    description: "What will block staff today — unbookable stylists, stock, money, config.",
    group: "People",
    requires: "canManageStaff",
    href: "health",
  },
  {
    key: "inventory",
    label: "Inventory Adjustment",
    description: "Stock in, out, damage, expiry, loss and transfers.",
    group: "Stock",
    requires: "canAdjustInventory",
    href: "inventory",
  },
];

/** The operations a role may actually perform, in catalogue order. */
export function operationsFor(caps: OperationsCapability): OperationDef[] {
  return OPERATIONS.filter((op) => caps[op.requires]);
}

export const OPERATION_GROUPS: OperationGroup[] = ["Front desk", "Money", "People", "Stock"];

// ============================================================================
// EXPENSES
// ============================================================================

export const EXPENSE_CATEGORIES = [
  "ELECTRICITY",
  "RENT",
  "CLEANING",
  "PANTRY",
  "MAINTENANCE",
  "MARKETING",
  "SUPPLIES",
  "TRANSPORT",
  "MISCELLANEOUS",
  "OTHERS",
] as const;

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number];

/**
 * Display label for an expense category. When the category is OTHERS the user
 * typed their own label, stored in customCategory — show that instead of the
 * generic "Others".
 */
export function expenseCategoryLabel(
  category: string,
  customCategory?: string | null,
): string {
  if (category === "OTHERS" && customCategory?.trim()) return customCategory.trim();
  return labelise(category);
}

export const PAYMENT_METHODS = [
  "CASH",
  "UPI",
  "CARD",
  "ONLINE",
  "WALLET",
  "GIFT_CARD",
  "LOYALTY_POINTS",
  "MEMBERSHIP",
] as const;

/** Methods that make sense for money going OUT of the branch. */
export const EXPENSE_PAYMENT_METHODS = ["CASH", "UPI", "CARD", "ONLINE"] as const;

// ============================================================================
// FORMATTING
// ============================================================================

/** "PHONE_CALL" → "Phone Call". Shared by every operations surface. */
export function labelise(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatMoney(value: number): string {
  return `₹${Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
