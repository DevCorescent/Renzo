// ============================================================================
// OWNER  : Gauransh
// MODULE : Worker Leaves — shared types & helpers
//
// The shapes here mirror what the backend actually returns — nothing is invented.
//   • GET  /api/v1/worker/leaves       → PaginatedData<LeaveRow>
//   • POST /api/v1/worker/leaves       → LeaveRow (leaveType included)
//   • DELETE /api/v1/worker/leaves/:id → null
//
// LeaveType is the global catalog (prisma model LeaveType). There is no
// worker-facing endpoint that lists it, so the active rows are read once in the
// Server Component and passed down — see the page for why that is the correct
// fallback rather than an invented API.
// ============================================================================

/** The Badge tones from components/shared/ui (its `Tone` type is not exported). */
type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

/** Matches the Prisma LeaveStatus enum exactly. */
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

/** The subset of LeaveType the UI needs. The catalog carries more, unused here. */
export type LeaveTypeOption = {
  id: string;
  name: string;
  code: string;
  isPaid: boolean;
};

/** The embedded leaveType on a Leave row (GET/POST both include it). */
export type LeaveTypeRef = {
  id: string;
  name: string;
  code: string;
};

/**
 * One leave request, as the API serialises it. Dates arrive as ISO strings
 * (Prisma @db.Date → UTC-midnight ISO). `days` is a Float the SERVER computed —
 * the client never authors it, it only previews it.
 */
export type LeaveRow = {
  id: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  rejectionReason: string | null;
  createdAt: string;
  leaveType: LeaveTypeRef;
};

/** The API envelope. Every response is wrapped by lib/response.ts. */
export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
};

export type PaginatedData<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/** Status → badge tone. Kept beside the type so the two never drift. */
export const STATUS_TONE: Record<LeaveStatus, Tone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

/**
 * Inclusive day count between two YYYY-MM-DD strings — the SAME formula the route
 * uses (floor(diff / 86_400_000) + 1). Computed in UTC so a DST boundary can never
 * add or drop a day. Returns 0 when either date is missing or the range inverts,
 * which the read-only "Total days" preview renders as a dash.
 */
export function inclusiveDays(startISO: string, endISO: string): number {
  if (!startISO || !endISO) return 0;
  const start = Date.parse(`${startISO}T00:00:00.000Z`);
  const end = Date.parse(`${endISO}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

/** ISO date → "12 Jul 2026". UTC-pinned so a UTC-midnight date never rolls back. */
export function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
