// ============================================================================
// MODULE : Worker readiness
//
// A stylist is only BOOKABLE when several separate things line up: an active
// profile, a branch posting, at least one service they are qualified for, and a
// roster. Miss any one and the booking engine refuses — correctly, but at the
// worst possible moment: with a customer standing at the desk.
//
// This module answers "is this person actually bookable, and if not, what is
// missing" so the problem surfaces on the WORKER page, where someone can fix it,
// rather than at the counter, where nobody can.
//
// Pure computation over rows the caller loads. No Prisma, no request context —
// so the worker page, the health dashboard and any future report share one
// definition of "ready".
// ============================================================================

export type WorkerReadinessInput = {
  id: string;
  name: string;
  employeeCode: string;
  isActive: boolean;
  /** Active branch postings. */
  branchCount: number;
  /** Active services this worker is qualified to perform. */
  serviceCount: number;
  /** Active shift assignments. */
  shiftCount: number;
  /** Distinct weekdays covered by those shifts, 0 = Sunday. */
  workingDays: number[];
};

export type ReadinessIssueKey =
  | "INACTIVE"
  | "NO_BRANCH"
  | "NO_SERVICES"
  | "NO_SHIFT"
  | "NO_WORKING_DAYS";

export type ReadinessIssue = {
  key: ReadinessIssueKey;
  /** BLOCKER = cannot be booked at all. WARNING = bookable but degraded. */
  severity: "BLOCKER" | "WARNING";
  label: string;
  detail: string;
  /** Which tab of the worker page fixes it. */
  fixTab: "profile" | "branches" | "services" | "shifts";
};

export type WorkerReadiness = {
  worker: WorkerReadinessInput;
  issues: ReadinessIssue[];
  /** No BLOCKERs — reception can name this stylist on a booking. */
  bookable: boolean;
};

/**
 * What stops this worker being booked.
 *
 * SEVERITY IS THE POINT. No services is a BLOCKER because the booking engine
 * rejects the stylist outright. No shift is a WARNING: the appointment still
 * saves, but the person is not on any roster, so attendance and availability
 * will look wrong — worth fixing, not worth blocking the desk over.
 */
export function assessWorker(worker: WorkerReadinessInput): WorkerReadiness {
  const issues: ReadinessIssue[] = [];

  if (!worker.isActive) {
    issues.push({
      key: "INACTIVE",
      severity: "BLOCKER",
      label: "Deactivated",
      detail: "This employee is deactivated and cannot be booked or marked present.",
      fixTab: "profile",
    });
  }

  if (worker.branchCount === 0) {
    issues.push({
      key: "NO_BRANCH",
      severity: "BLOCKER",
      label: "No branch",
      detail: "Not posted to any branch, so no branch can book them.",
      fixTab: "branches",
    });
  }

  if (worker.serviceCount === 0) {
    issues.push({
      key: "NO_SERVICES",
      severity: "BLOCKER",
      label: "No services",
      detail:
        "Qualified for nothing, so naming them on a booking is refused. This is the most common cause of a failed walk-in.",
      fixTab: "services",
    });
  }

  if (worker.shiftCount === 0) {
    issues.push({
      key: "NO_SHIFT",
      severity: "WARNING",
      label: "No shift",
      detail:
        "No roster assigned, so late minutes and overtime cannot be calculated for them.",
      fixTab: "shifts",
    });
  } else if (worker.workingDays.length === 0) {
    issues.push({
      key: "NO_WORKING_DAYS",
      severity: "WARNING",
      label: "No working days",
      detail: "Their shift covers no weekdays, so every day reads as a week-off.",
      fixTab: "shifts",
    });
  }

  return {
    worker,
    issues,
    bookable: !issues.some((i) => i.severity === "BLOCKER"),
  };
}

/** Roll a team up into the counts a dashboard shows. */
export function summariseReadiness(all: WorkerReadiness[]) {
  const count = (key: ReadinessIssueKey) =>
    all.filter((r) => r.issues.some((i) => i.key === key)).length;

  return {
    total: all.length,
    bookable: all.filter((r) => r.bookable).length,
    blocked: all.filter((r) => !r.bookable).length,
    missingServices: count("NO_SERVICES"),
    missingBranch: count("NO_BRANCH"),
    missingShift: count("NO_SHIFT"),
    missingWorkingDays: count("NO_WORKING_DAYS"),
    inactive: count("INACTIVE"),
  };
}
