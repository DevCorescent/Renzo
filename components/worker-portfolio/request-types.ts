// ============================================================================
// OWNER  : Gauransh
// MODULE : Portfolio Change Requests (UI) — client-safe types & labels
//
// Presentation-only mirror of the request enums. It is intentionally SEPARATE from
// lib/portfolio-requests.ts: that module imports the Prisma client (for the
// apply-on-approve writes) and must never be pulled into a browser bundle. This
// holds just the labels, status styling and a human-readable summariser the UI
// needs — no server code, no duplicated business logic.
// ============================================================================

export type PortfolioRequestType =
  | "BIO"
  | "EXPERIENCE"
  | "LANGUAGE"
  | "CERTIFICATE"
  | "SKILL"
  | "SKILL_LEVEL"
  | "GALLERY";

export type PortfolioRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_CHANGES";

/** Badge tones from components/shared/ui. */
type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

export const TYPE_LABELS: Record<PortfolioRequestType, string> = {
  BIO: "Professional bio",
  EXPERIENCE: "Experience",
  LANGUAGE: "Languages",
  CERTIFICATE: "Certificates",
  SKILL: "New skill",
  SKILL_LEVEL: "Skill level",
  GALLERY: "Portfolio work",
};

export const STATUS_CONFIG: Record<PortfolioRequestStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  APPROVED: { label: "Approved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "danger" },
  NEEDS_CHANGES: { label: "Needs changes", tone: "info" },
};

/** One change request, as GET /api/v1/worker/portfolio-requests serialises it. */
export type PortfolioRequest = {
  id: string;
  type: PortfolioRequestType;
  status: PortfolioRequestStatus;
  payload: Record<string, unknown>;
  previousValue: Record<string, unknown> | null;
  attachments: string[];
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A human-readable one-line summary of what a request proposes — never raw JSON. */
export function describeRequest(type: PortfolioRequestType, payload: Record<string, unknown>): string {
  switch (type) {
    case "BIO":
      return "Updated professional bio";
    case "EXPERIENCE":
      return `Experience → ${Number(payload.experience) || 0} years`;
    case "LANGUAGE":
      return `Languages → ${asList(payload.languages)}`;
    case "CERTIFICATE":
      return `Certificates → ${asList(payload.certificates)}`;
    case "SKILL":
    case "SKILL_LEVEL":
      return `Proficiency → ${Number(payload.proficiency) || 0}/5`;
    case "GALLERY":
      return `New ${String(payload.category ?? "").toLowerCase() || "portfolio"} work${
        payload.title ? `: ${payload.title}` : ""
      }`;
  }
}

function asList(v: unknown): string {
  return Array.isArray(v) ? v.filter(Boolean).join(", ") : "—";
}

/** ISO → "12 Jul 2026", UTC-pinned. */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
