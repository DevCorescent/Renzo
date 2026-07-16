// OWNER: Gauransh
// MODULE: Coupon Management (shared types & helpers)
// PURPOSE: Shapes mirror EXACTLY what the admin coupon endpoints return — the
//          extended GET /admin/coupons (list), GET /admin/coupons/[id] (detail +
//          usages), and GET /admin/coupons/analytics. Status and validity text are
//          DERIVED live from isActive + validFrom + validUntil (no stored column).

export type CouponType = "FLAT" | "PERCENTAGE";
export type ApplicableTo = "ALL" | "SPECIFIC_SERVICE" | "SPECIFIC_CATEGORY" | "SPECIFIC_BRANCH" | "FIRST_BOOKING";
export type CouponStatus = "active" | "upcoming" | "expired" | "disabled";
export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

/** One coupon row from GET /api/v1/admin/coupons. */
export type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  minOrderAmount: number;
  maxDiscount: number | null;
  applicableTo: ApplicableTo;
  refId: string | null;
  usageLimit: number | null;
  usageLimitPerCustomer: number;
  usedCount: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { usages: number };
};

/** One usage row embedded in GET /api/v1/admin/coupons/[id]. */
export type CouponUsageRow = {
  id: string;
  appointmentId: string | null;
  invoiceId: string | null;
  discountAmount: number;
  usedAt: string;
  customer: { firstName: string; lastName: string | null };
};

/** Coupon detail = the row plus its usage history. */
export type CouponDetail = CouponRow & { usages: CouponUsageRow[] };

export type CouponAnalytics = {
  totalCoupons: number;
  activeCoupons: number;
  expiredCoupons: number;
  upcomingCoupons: number;
  couponsUsed: number;
  couponsRemaining: number;
  totalDiscountGiven: number;
  mostUsedCoupon: { code: string; usedCount: number } | null;
};

export type ApiEnvelope<T> = { success: boolean; message: string; data?: T; errors?: Record<string, string[]> };
export type Paginated<T> = { items: T[]; total: number; page: number; limit: number; totalPages: number };

export const TYPES: { value: CouponType; label: string }[] = [
  { value: "FLAT", label: "Flat (₹)" },
  { value: "PERCENTAGE", label: "Percentage (%)" },
];
export const APPLICABLE: { value: ApplicableTo; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "SPECIFIC_SERVICE", label: "Specific service" },
  { value: "SPECIFIC_CATEGORY", label: "Specific category" },
  { value: "SPECIFIC_BRANCH", label: "Specific branch" },
  { value: "FIRST_BOOKING", label: "First booking" },
];
export const applicableLabel = (v: ApplicableTo): string => APPLICABLE.find((a) => a.value === v)?.label ?? v;

export const STATUS_META: Record<CouponStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  upcoming: { label: "Upcoming", tone: "warning" },
  expired: { label: "Expired", tone: "danger" },
  disabled: { label: "Disabled", tone: "neutral" },
};

export const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
/** FLAT → ₹value, PERCENTAGE → value%. */
export const couponValue = (c: Pick<CouponRow, "type" | "value">) => (c.type === "FLAT" ? money(c.value) : `${c.value}%`);

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "—" : new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Derive status from the three real fields (no stored status column). */
export function couponStatus(c: Pick<CouponRow, "isActive" | "validFrom" | "validUntil">, now: number): CouponStatus {
  if (!c.isActive) return "disabled";
  const vf = Date.parse(c.validFrom);
  const vu = c.validUntil ? Date.parse(c.validUntil) : null;
  if (!Number.isNaN(vf) && vf > now) return "upcoming";
  if (vu !== null && !Number.isNaN(vu) && vu < now) return "expired";
  return "active";
}

const DAY = 24 * 60 * 60 * 1000;
const dayCount = (ms: number) => Math.max(1, Math.round(Math.abs(ms) / DAY));

/** Human validity line, e.g. "Valid until 25 Dec 2026", "Expired 3 days ago",
 *  "Starts in 5 days". Computed dynamically from validFrom/validUntil. */
export function validityText(c: Pick<CouponRow, "isActive" | "validFrom" | "validUntil">, now: number): string {
  const status = couponStatus(c, now);
  if (status === "disabled") return "Disabled";
  if (status === "upcoming") { const d = dayCount(Date.parse(c.validFrom) - now); return `Starts in ${d} day${d === 1 ? "" : "s"}`; }
  if (status === "expired") { const d = dayCount(now - Date.parse(c.validUntil as string)); return `Expired ${d} day${d === 1 ? "" : "s"} ago`; }
  return c.validUntil ? `Valid until ${formatDate(c.validUntil)}` : "No expiry";
}
