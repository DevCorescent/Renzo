import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import prisma from "@/lib/db";
import { apiGet, type Paginated } from "@/lib/api-server";
import { PageHeader } from "@/components/shared/ui";
import { LeaveStatsCards, LeavesEmpty, LeavesError } from "@/components/branch-leaves/leaves-ui";
import { LeavesToolbar } from "@/components/branch-leaves/leaves-toolbar";
import { LeavesView } from "@/components/branch-leaves/leaves-view";
import type {
  BranchLeave,
  LeaveStats,
  LeaveTypeOption,
} from "@/components/branch-leaves/types";

// OWNER: Gauransh | MODULE: Branch Admin — Leave Management
//
// BACKEND:
//   GET  /api/v1/admin/leaves          (search, status, leaveTypeId, from, to,
//                                        sortBy, sortOrder, page, limit)
//   GET  /api/v1/admin/leaves/stats
//   POST /api/v1/admin/leaves/[id]/approve | /reject   (via actions.ts)
//
// The page NEVER touches Prisma for leave data or applies branch isolation itself:
// the API resolves the caller's branch from the session cookie and scopes the query
// through WorkerBranch, so a branch admin only ever sees their own branch's leaves.
//
// THE ONE PRISMA READ HERE is the active LeaveType catalog for the filter dropdown.
// There is no worker/branch-admin-facing endpoint to list leave types (that route
// is SUPER_ADMIN/OWNER only), and LeaveType is a GLOBAL, non-sensitive lookup —
// so it is read server-side exactly as the worker leaves page does. It is reference
// data for a filter, never a leave record.

/** Whitelisted before they reach the API — junk params never leave the page. */
const PASSTHROUGH = [
  "search",
  "status",
  "leaveTypeId",
  "from",
  "to",
  "sortBy",
  "sortOrder",
  "page",
  "limit",
] as const;

/** Map a transport/HTTP status to a message that never leaks internals. */
function friendlyError(status: number, message: string): string {
  switch (status) {
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You do not have access to leave requests for this branch.";
    case 0:
      return "Could not reach the server. Check your connection and try again.";
    case 500:
      return "Something went wrong on our end. Please try again shortly.";
    default:
      return message || "Could not load leave requests.";
  }
}

export default async function BranchAdminLeavesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const authUser = await getServerUser();

  // proxy.ts gates /branch-admin/*; this is the second line and the API is the
  // third. A branch admin with no branch is refused by requireBranchScope anyway.
  if (!authUser?.branchId) redirect("/login");

  const raw = await searchParams;

  const params = new URLSearchParams();
  for (const key of PASSTHROUGH) {
    const value = raw[key];
    const v = Array.isArray(value) ? value[0] : value;
    if (v?.trim()) params.set(key, v.trim());
  }

  // List + stats + the leave-type catalog, in parallel. Prisma read is wrapped so a
  // catalog hiccup can never take the page down (apiGet already never throws).
  const [listResult, statsResult, leaveTypes] = await Promise.all([
    apiGet<Paginated<BranchLeave>>(`/api/v1/admin/leaves?${params.toString()}`),
    apiGet<LeaveStats>("/api/v1/admin/leaves/stats"),
    prisma.leaveType
      .findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, code: true },
      })
      .catch((): LeaveTypeOption[] => []),
  ]);

  const stats: LeaveStats =
    statsResult.ok
      ? statsResult.data
      : { pending: 0, approved: 0, rejected: 0, cancelled: 0, total: 0 };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Team"
        title="Leaves"
        subtitle="Review and action your workers' leave requests."
      />

      <LeaveStatsCards stats={stats} />

      <LeavesToolbar leaveTypes={leaveTypes} />

      {!listResult.ok ? (
        <LeavesError message={friendlyError(listResult.status, listResult.message)} />
      ) : listResult.data.items.length === 0 ? (
        <LeavesEmpty filtered={params.toString().length > 0} />
      ) : (
        <LeavesView
          leaves={listResult.data.items}
          total={listResult.data.total}
          page={listResult.data.page}
          limit={listResult.data.limit}
          totalPages={listResult.data.totalPages}
        />
      )}
    </div>
  );
}
