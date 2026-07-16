// OWNER: Gauransh
// MODULE: Membership Management (shared types & helpers)
// FLOW  : Shapes mirror EXACTLY what the admin membership endpoints return — the
//         extended GET /admin/memberships/plans (with per-plan stats), the analytics
//         read, and the plan-customers read. A field absent from those responses is
//         absent here, so the UI never renders an invented value.
// ACCESS: Client-side types only; the backend enforces SUPER_ADMIN/OWNER.

export type MembershipTier = "SILVER" | "GOLD" | "PLATINUM" | "CUSTOM";
export type MembershipStatus = "ACTIVE" | "EXPIRED" | "FROZEN" | "CANCELLED";
export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

export type Benefit = { id: string; name: string; value: string };

/** One plan row from GET /api/v1/admin/memberships/plans (enriched with stats). */
export type PlanRow = {
  id: string;
  name: string;
  tier: MembershipTier;
  price: number;
  validityDays: number;
  description: string | null;
  discountPercent: number;
  walletCredit: number;
  priorityBooking: boolean;
  branchAccess: string;
  isActive: boolean;
  sortOrder: number;
  totalMembers: number;
  activeMembers: number;
  revenue: number;
  benefits: Benefit[];
};

export type Analytics = {
  totalPlans: number;
  activePlans: number;
  totalActiveMembers: number;
  totalRevenue: number;
  mostPopularPlan: { id: string; name: string; activeMembers: number } | null;
  renewalDue: number;
};

/** Per-plan statistics from GET .../plans/[id] (additive `stats` block). */
export type PlanStats = {
  total: number;
  active: number;
  frozen: number;
  expired: number;
  cancelled: number;
  revenue: number;
  renewalsDue: number;
  latestPurchase: string | null;
};

/** One subscriber row from GET .../plans/[id]/customers. */
export type MemberRow = {
  id: string;
  status: MembershipStatus;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  plan: { name: string; tier: MembershipTier; branchAccess: string };
  customer: {
    id: string;
    firstName: string;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    profilePhoto: string | null;
    totalVisits: number;
    totalSpend: number;
    loyaltyAccount: { tier: string } | null;
  };
};

export type ApiEnvelope<T> = { success: boolean; message: string; data?: T; errors?: Record<string, string[]> };
export type Paginated<T> = { items: T[]; total: number; page: number; limit: number; totalPages: number };

export const TIERS: { value: MembershipTier; label: string }[] = [
  { value: "SILVER", label: "Silver" },
  { value: "GOLD", label: "Gold" },
  { value: "PLATINUM", label: "Platinum" },
  { value: "CUSTOM", label: "Custom" },
];

export const TIER_TONE: Record<MembershipTier, Tone> = { SILVER: "info", GOLD: "warning", PLATINUM: "primary", CUSTOM: "neutral" };
export const STATUS_TONE: Record<MembershipStatus, Tone> = { ACTIVE: "success", EXPIRED: "danger", FROZEN: "info", CANCELLED: "neutral" };

export const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export function customerName(c: MemberRow["customer"]): string {
  return `${c.firstName} ${c.lastName ?? ""}`.trim() || "—";
}
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "—" : new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Whole days remaining until `endDate` from `now` (display only; 0 once elapsed). */
export function remainingDays(endIso: string, now: number): number {
  const end = Date.parse(endIso);
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - now) / (24 * 60 * 60 * 1000)));
}
