// ============================================================================
// MODULE : Attendance Management (admin)
// ROUTE  : /api/v1/admin/attendance/report
//
// METHOD
//   GET — A grouped attendance report.
//
//   ?groupBy = daily | weekly | monthly | yearly | worker | branch | shift
//   plus every filter the list endpoint reads, which is what produces the named
//   reports without a separate endpoint each:
//
//     Late report      ?late=true
//     Overtime report  ?overtime=true
//     Absent report    ?status=ABSENT
//     Leave report     ?status=ON_LEAVE
//     Per branch       ?groupBy=branch
//     Per worker       ?groupBy=worker
//
// ACCESS: SUPER_ADMIN, OWNER, BRANCH_ADMIN. A branch admin's report is scoped to
// their branch by requireBranchScope(), exactly as their table is.
//
// Defaults to the current month when no range is supplied, so an unparameterised
// call returns something useful rather than every row ever written.
// ============================================================================

import { NextRequest } from "next/server";
import { ok, err } from "@/lib/response";
import { requireAuth } from "@/lib/auth-guard";
import { requireBranchScope } from "@/lib/branch-scope";
import { attendanceDateKey, formatDateKey } from "@/lib/attendance";
import { monthBounds, parseAttendanceFilters } from "@/lib/attendance-service";
import { buildAttendanceReport, isReportGroup } from "@/lib/attendance-report";

export async function GET(req: NextRequest) {
  const { user, error } = await requireAuth(req, "SUPER_ADMIN", "OWNER", "BRANCH_ADMIN");
  if (error) return error;

  const url = new URL(req.url);
  const { scope, error: scopeError } = requireBranchScope(user, url);
  if (scopeError) return scopeError;

  try {
    const groupByRaw = url.searchParams.get("groupBy")?.trim() ?? "daily";
    if (!isReportGroup(groupByRaw)) {
      return err("Validation failed", 422, {
        groupBy: ["Must be one of: daily, weekly, monthly, yearly, worker, branch, shift"],
      });
    }

    const parsed = parseAttendanceFilters(url);
    const fallback = monthBounds(attendanceDateKey());

    const filters = {
      ...parsed,
      from: parsed.from ?? fallback.start,
      to: parsed.to ?? fallback.end,
    };

    const report = await buildAttendanceReport(scope, filters, groupByRaw);

    return ok({
      ...report,
      range: { from: formatDateKey(filters.from), to: formatDateKey(filters.to) },
    });
  } catch {
    return err("Internal server error", 500);
  }
}
