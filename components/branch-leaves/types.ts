// ============================================================================
// OWNER  : Gauransh
// MODULE : Branch Admin — Leave Management (shared types & helpers)
//
// Shapes mirror the explicit `select` in GET /api/v1/admin/leaves and the stats
// route — nothing invented. The Leave model has no branchId (scoped through the
// worker) and no worker-name relation for `approvedBy` (it is a bare userId), so
// neither appears here.
// ============================================================================

/** The Badge tones from components/shared/ui (its `Tone` type is not exported). */
export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "primary";

export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

/** A worker's active branch link, as embedded on a leave row. */
export type WorkerBranchRef = {
  isPrimary: boolean;
  branch: { id: string; name: string; code: string };
};

/**
 * One leave request row, exactly as the list route selects it.
 *
 * No approvedBy / approvedAt / rejectionReason: the transition writes only the
 * status column, so there is nothing stored to surface for those. The type mirrors
 * the API — absent from the select means absent here.
 */
export type BranchLeave = {
  id: string;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  createdAt: string;
  leaveType: { id: string; name: string; code: string; isPaid: boolean };
  worker: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    employeeCode: string;
    profilePhoto: string | null;
    designation: { name: string } | null;
    branches: WorkerBranchRef[];
  };
};

export type LeaveStats = {
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  total: number;
  // Added additively by the stats route; older callers simply ignore them.
  today?: number;
  onLeaveToday?: number;
};

/** One leave-balance row for a worker/year, from GET /api/v1/admin/leaves/balance. */
export type LeaveBalanceRow = {
  id: string;
  year: number;
  allocated: number;
  used: number;
  pending: number;
  remaining: number;
  leaveType: { id: string; name: string; code: string; isPaid: boolean };
};

/** Active leave types, for the filter dropdown. */
export type LeaveTypeOption = { id: string; name: string; code: string };

export const STATUS_TONE: Record<LeaveStatus, Tone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

/** A worker's display name, preferring the explicit displayName. */
export function workerName(w: BranchLeave["worker"]): string {
  return (w.displayName?.trim() || `${w.firstName} ${w.lastName}`.trim()) || "—";
}

/** The worker's primary active branch name (falls back to the first), or a dash. */
export function workerBranchName(w: BranchLeave["worker"]): string {
  const links = w.branches ?? [];
  const primary = links.find((b) => b.isPrimary) ?? links[0];
  return primary?.branch.name ?? "—";
}

/** ISO date → "12 Jul 2026", UTC-pinned so a UTC-midnight @db.Date never rolls back. */
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
