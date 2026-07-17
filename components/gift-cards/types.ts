// OWNER: Gauransh
// MODULE: Marketing — Gift Card types & helpers
// PURPOSE: Shapes mirror the extended GET /admin/gift-cards (with purchasedByName /
//          ownerName / redemption _count) and GET /admin/gift-cards/[id] (owner +
//          redemptions) and GET /admin/gift-cards/analytics. Nothing invented.

export type GiftCardType = "DIGITAL" | "PHYSICAL";
export type GiftCardStatus = "ACTIVE" | "REDEEMED" | "EXPIRED" | "CANCELLED";
export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

export type GiftCardRow = {
  id: string;
  code: string;
  type: GiftCardType;
  value: number;
  balance: number;
  status: GiftCardStatus;
  recipientName: string | null;
  recipientPhone: string | null;
  giftMessage: string | null;
  expiresAt: string | null;
  purchasedAt: string;
  _count: { redemptions: number };
  purchasedByName: string | null;
  ownerName: string | null;
};

export type GiftCardRedemptionRow = { id: string; invoiceId: string; amount: number; redeemedAt: string };
/** One ownership transfer, derived from AuditLog (names only, never ids). */
export type GiftCardTransferRow = { id: string; at: string; from: string; to: string };
export type GiftCardDetail = GiftCardRow & {
  redemptions: GiftCardRedemptionRow[];
  transfers: GiftCardTransferRow[];
  owner: { id: string; firstName: string; lastName: string | null; phone: string | null } | null;
};

export type GiftCardAnalytics = {
  totalGiftCards: number;
  activeGiftCards: number;
  purchasedByCustomers: number;
  redeemedCards: number;
};

export type ApiEnvelope<T> = { success: boolean; message: string; data?: T; errors?: Record<string, string[]> };
export type Paginated<T> = { items: T[]; total: number; page: number; limit: number; totalPages: number };

export const TYPES: { value: GiftCardType; label: string }[] = [
  { value: "DIGITAL", label: "Digital" },
  { value: "PHYSICAL", label: "Physical" },
];
export const STATUSES: GiftCardStatus[] = ["ACTIVE", "REDEEMED", "EXPIRED", "CANCELLED"];
export const STATUS_TONE: Record<GiftCardStatus, Tone> = {
  ACTIVE: "success", REDEEMED: "info", EXPIRED: "danger", CANCELLED: "neutral",
};

export const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "—" : new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
