// ============================================================================
// MODULE : Attendance — shared page compositions (Server Components)
//
// Super Admin and Branch Admin get the SAME three screens. The only differences
// are the base path, whether the branch filter is offered, and which capabilities
// the role carries — all of which are props.
//
// Duplicating these as six near-identical page files is how the branch-admin copy
// eventually loses a column, or keeps a Delete button its API no longer honours.
//
// DATA POLICY, following the precedent set by the Leave module's pages:
//   • Attendance data comes over HTTP through apiGet(), so the API applies the
//     real RBAC and branch scoping — the page duplicates NO authorization logic.
//   • Filter LOOKUPS (branches) are read directly with Prisma, exactly as
//     super-admin/leaves does; they are non-sensitive reference data.
//   • Employee options are fetched through the branch-scoped workers API, NOT
//     Prisma, precisely because that list must not span branches.
// ============================================================================

import prisma from "@/lib/db";
import { apiGet, type Paginated, type WorkerListItem } from "@/lib/api-server";
import { API } from "@/lib/endpoints";
import { PageHeader } from "@/components/shared/ui";
import { capabilitiesFor, type AttendanceCapability } from "@/lib/attendance";
import type { UserType } from "@/types/api";
import { AttendanceTabs } from "@/components/attendance/attendance-tabs";
import { AttendanceToolbar } from "@/components/attendance/attendance-toolbar";
import { AttendanceStatsCards } from "@/components/attendance/attendance-stats-cards";
import { AttendanceView } from "@/components/attendance/attendance-view";
import { AttendanceCalendarGrid } from "@/components/attendance/attendance-calendar";
import { AttendanceReportView } from "@/components/attendance/attendance-report-view";
import { AttendanceError, friendlyError } from "@/components/attendance/attendance-ui";
import {
  EMPTY_SUMMARY,
  type AttendanceCalendar,
  type AttendanceReport,
  type AttendanceRow,
  type AttendanceSummary,
  type BranchOption,
  type ShiftOption,
  type ShiftRow,
  type WorkerOption,
} from "@/components/attendance/types";

export type AttendanceSurface = {
  /** e.g. "/super-admin/attendance". */
  basePath: string;
  /** Rendered as a fourth tab only for roles that may author shift templates. */
  shiftsPath?: string;
  eyebrow: string;
  subtitle: string;
  capabilities: AttendanceCapability;
  /** True for SUPER_ADMIN / OWNER — controls whether the branch filter is offered. */
  isGlobal: boolean;
  /** POST target for marking. Branch admins use their own door. */
  markEndpoint: string;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Assemble a surface from the route tree it lives in plus the caller's role.
 *
 * `basePath` comes from the PAGE (a Super Admin is allowed into /branch-admin/*,
 * so the tree is not derivable from the role), while capabilities and global reach
 * come from the ROLE — read from the same capabilitiesFor() the API enforces with.
 */
export function buildSurface(options: {
  basePath: string;
  shiftsPath?: string;
  eyebrow: string;
  subtitle: string;
  userType: UserType;
  markEndpoint: string;
}): AttendanceSurface {
  return {
    basePath: options.basePath,
    shiftsPath: options.shiftsPath,
    eyebrow: options.eyebrow,
    subtitle: options.subtitle,
    markEndpoint: options.markEndpoint,
    capabilities: capabilitiesFor(options.userType),
    isGlobal: options.userType === "SUPER_ADMIN" || options.userType === "OWNER",
  };
}

/** Whitelisted before they reach the API — junk params never leave the page. */
const PASSTHROUGH = [
  "search", "branchId", "workerId", "shiftId", "status",
  "from", "to", "date", "late", "overtime",
  "sortBy", "sortOrder", "page", "limit",
] as const;

function toQuery(raw: RawSearchParams, extra: readonly string[] = []): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of [...PASSTHROUGH, ...extra]) {
    const value = raw[key];
    const single = Array.isArray(value) ? value[0] : value;
    if (single?.trim()) params.set(key, single.trim());
  }
  return params;
}

const ENDPOINTS = {
  bulk: API.admin.attendanceBulk,
  recordBase: API.admin.attendance,
  export: API.admin.attendanceExport,
};

// ============================================================================
// FILTER OPTIONS
// ============================================================================

type FilterOptions = {
  branches: BranchOption[];
  workers: WorkerOption[];
  shifts: ShiftOption[];
};

/**
 * Load the three dropdowns.
 *
 * Every lookup is failure-tolerant: a filter that cannot be populated must degrade
 * to an empty select, never take down the page it decorates. This is the exact
 * failure the api-server module's header warns about.
 */
async function loadFilterOptions(isGlobal: boolean): Promise<FilterOptions> {
  const [branches, workersResult, shiftsResult] = await Promise.all([
    isGlobal
      ? prisma.branch
          .findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          })
          .catch((): BranchOption[] => [])
      : Promise.resolve<BranchOption[]>([]),

    // Through the API, not Prisma: this list MUST be branch-scoped for a branch
    // admin, and the API is what knows how to do that.
    apiGet<Paginated<WorkerListItem>>(`${API.admin.workers}?limit=100`),

    apiGet<Paginated<ShiftRow>>(`${API.admin.shifts}?limit=100`),
  ]);

  const workers: WorkerOption[] = workersResult.ok
    ? workersResult.data.items
        .filter((w) => w.isActive)
        .map((w) => ({
          id: w.id,
          name: w.displayName?.trim() || `${w.firstName} ${w.lastName}`.trim(),
          employeeCode: w.employeeCode,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  const shifts: ShiftOption[] = shiftsResult.ok
    ? shiftsResult.data.items.map((s) => ({ id: s.id, name: s.name }))
    : [];

  return { branches, workers, shifts };
}

// ============================================================================
// RECORDS
// ============================================================================

export async function AttendanceRecordsPage({
  surface,
  searchParams,
}: {
  surface: AttendanceSurface;
  searchParams: RawSearchParams;
}) {
  const query = toQuery(searchParams);

  const [listResult, summaryResult, options] = await Promise.all([
    apiGet<Paginated<AttendanceRow>>(`${API.admin.attendance}?${query.toString()}`),
    apiGet<AttendanceSummary>(`${API.admin.attendanceSummary}?${query.toString()}`),
    loadFilterOptions(surface.isGlobal),
  ]);

  const summary: AttendanceSummary = summaryResult.ok ? summaryResult.data : EMPTY_SUMMARY;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={surface.eyebrow} title="Attendance" subtitle={surface.subtitle} />

      <AttendanceTabs basePath={surface.basePath} shiftsPath={surface.shiftsPath} />

      <AttendanceStatsCards summary={summary} />

      <AttendanceToolbar
        branches={options.branches}
        workers={options.workers}
        shifts={options.shifts}
        showBranchFilter={surface.isGlobal}
      />

      {!listResult.ok ? (
        <AttendanceError message={friendlyError(listResult.status, listResult.message)} />
      ) : (
        <AttendanceView
          rows={listResult.data.items}
          total={listResult.data.total}
          page={listResult.data.page}
          limit={listResult.data.limit}
          totalPages={listResult.data.totalPages}
          workers={options.workers}
          capabilities={surface.capabilities}
          endpoints={{ ...ENDPOINTS, mark: surface.markEndpoint }}
        />
      )}
    </div>
  );
}

// ============================================================================
// CALENDAR
// ============================================================================

export async function AttendanceCalendarPage({
  surface,
  searchParams,
}: {
  surface: AttendanceSurface;
  searchParams: RawSearchParams;
}) {
  const query = toQuery(searchParams, ["month"]);

  const [calendarResult, options] = await Promise.all([
    apiGet<AttendanceCalendar>(`${API.admin.attendanceCalendar}?${query.toString()}`),
    loadFilterOptions(surface.isGlobal),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={surface.eyebrow}
        title="Attendance calendar"
        subtitle="A month at a glance. Filter to one employee for their personal calendar."
      />

      <AttendanceTabs basePath={surface.basePath} shiftsPath={surface.shiftsPath} />

      <AttendanceToolbar
        branches={options.branches}
        workers={options.workers}
        shifts={options.shifts}
        showBranchFilter={surface.isGlobal}
      />

      {!calendarResult.ok ? (
        <AttendanceError message={friendlyError(calendarResult.status, calendarResult.message)} />
      ) : (
        <AttendanceCalendarGrid data={calendarResult.data} />
      )}
    </div>
  );
}

// ============================================================================
// REPORTS
// ============================================================================

export async function AttendanceReportsPage({
  surface,
  searchParams,
}: {
  surface: AttendanceSurface;
  searchParams: RawSearchParams;
}) {
  const query = toQuery(searchParams, ["groupBy"]);

  const [reportResult, options] = await Promise.all([
    apiGet<AttendanceReport>(`${API.admin.attendanceReport}?${query.toString()}`),
    loadFilterOptions(surface.isGlobal),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={surface.eyebrow}
        title="Attendance reports"
        subtitle="Daily, weekly, monthly and yearly totals — plus late, overtime, absence and leave."
      />

      <AttendanceTabs basePath={surface.basePath} shiftsPath={surface.shiftsPath} />

      <AttendanceToolbar
        branches={options.branches}
        workers={options.workers}
        shifts={options.shifts}
        showBranchFilter={surface.isGlobal}
      />

      {!reportResult.ok ? (
        <AttendanceError message={friendlyError(reportResult.status, reportResult.message)} />
      ) : (
        <AttendanceReportView report={reportResult.data} exportEndpoint={ENDPOINTS.export} />
      )}
    </div>
  );
}
