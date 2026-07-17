// OWNER: Gauransh
// MODULE: Marketing — Campaign types & helpers
// PURPOSE: Shapes mirror the extended GET /admin/campaigns (with branchName /
//          participation / createdByName), GET /admin/campaigns/[id] (logs +
//          participation) and GET /admin/campaigns/analytics. Nothing invented.

export type CampaignChannel = "WHATSAPP" | "SMS" | "EMAIL" | "PUSH";
export type CampaignStatus = "DRAFT" | "SCHEDULED" | "RUNNING" | "COMPLETED" | "FAILED";
export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

export type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  channel: CampaignChannel;
  status: CampaignStatus;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  openCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
  branchName: string | null;
  participation: number;
  createdByName: string | null;
};

export type CampaignLogRow = { id: string; status: string; channel: CampaignChannel; sentAt: string };
export type CampaignDetail = CampaignRow & { participation: number; logs: CampaignLogRow[]; branch: { name: string } | null };

export type CampaignAnalytics = {
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  customerParticipation: number;
};

export type ApiEnvelope<T> = { success: boolean; message: string; data?: T; errors?: Record<string, string[]> };
export type Paginated<T> = { items: T[]; total: number; page: number; limit: number; totalPages: number };

export const CHANNELS: { value: CampaignChannel; label: string }[] = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "SMS", label: "SMS" },
  { value: "EMAIL", label: "Email" },
  { value: "PUSH", label: "Push" },
];
export const STATUSES: CampaignStatus[] = ["DRAFT", "SCHEDULED", "RUNNING", "COMPLETED", "FAILED"];
export const STATUS_TONE: Record<CampaignStatus, Tone> = {
  DRAFT: "neutral", SCHEDULED: "info", RUNNING: "primary", COMPLETED: "success", FAILED: "danger",
};

/** Editable only before a campaign has gone out (mirrors the PATCH route's rule). */
export const isEditable = (s: CampaignStatus) => s === "DRAFT" || s === "SCHEDULED";
/** Non-terminal campaigns can be toggled DRAFT⇄SCHEDULED (deactivate/activate). */
export const canToggle = (s: CampaignStatus) => s === "DRAFT" || s === "SCHEDULED" || s === "RUNNING";

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "—" : new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}
export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "—" : new Date(ms).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}
