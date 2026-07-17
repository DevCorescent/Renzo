// ============================================================================
// OWNER  : Gauransh
// MODULE : Branch Admin — Portfolio Requests (UI types)
//
// The admin list row = a change request PLUS the worker it belongs to (branch
// isolation is resolved server-side; the row already arrives scoped). The request
// shape and its labels/status config are REUSED from the worker module, not
// re-declared, so worker and admin never drift.
// ============================================================================

import type { PortfolioRequest } from "@/components/worker-portfolio/request-types";

/** The three decisions a reviewer can take on a request. Lives here (not in the
 *  "use server" actions file, which may export only async functions) so both the
 *  action and the UI share one definition. */
export type ReviewAction = "APPROVE" | "REJECT" | "NEEDS_CHANGES";

/** One request as GET /api/v1/admin/portfolio-requests serialises it (worker joined). */
export type AdminRequestRow = PortfolioRequest & {
  worker: {
    id: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    employeeCode: string;
    profilePhoto: string | null;
    designation: { name: string } | null;
    branches: { isPrimary: boolean; branch: { id: string; name: string } }[];
  };
};

/** The worker's display name, preferring the explicit displayName. */
export function workerName(w: AdminRequestRow["worker"]): string {
  return (w.displayName?.trim() || `${w.firstName} ${w.lastName}`.trim()) || "—";
}

/** The worker's primary active branch name (falls back to the first), or a dash. */
export function workerBranchName(w: AdminRequestRow["worker"]): string {
  const links = w.branches ?? [];
  const primary = links.find((b) => b.isPrimary) ?? links[0];
  return primary?.branch.name ?? "—";
}
