import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import prisma from "@/lib/db";
import { apiGet, type Paginated } from "@/lib/api-server";
import { PageHeader } from "@/components/shared/ui";
import { LeavesEmpty, LeavesError } from "@/components/branch-leaves/leaves-ui";
import { LeaveManagementTabs } from "@/components/leave-management/leave-management-tabs";
import { SuperLeaveStatsCards } from "@/components/leave-management/super-stats-cards";
import { SuperLeavesToolbar, type BranchOption } from "@/components/leave-management/super-leaves-toolbar";
import { SuperLeavesView } from "@/components/leave-management/super-leaves-view";
import type { BranchLeave, LeaveStats, LeaveTypeOption } from "@/components/branch-leaves/types";

// OWNER: Gauransh
// MODULE: Super Admin Leave Management
//
// BACKEND (all existing / additively extended — no new business logic, no Prisma
// changes): GET /api/v1/admin/leaves, /leaves/stats, /leaves/balance, and the
// PATCH /leaves/[id] approval via the Server Action. The page NEVER applies branch
// isolation itself — the API resolves the caller's scope from the session cookie, so
// a Super Admin sees every branch and may narrow with ?branchId.
//
// SCHEMA NOTE: Leave records exist for WORKERS only. There is no staff-leave data in
// the schema, so this dashboard is worker-scoped by design — no fabricated staff
// section. The module is structured (grouped view + shared types) so staff leaves
// could plug in later without a rewrite.

// proxy.ts admits BOTH SUPER_ADMIN and OWNER to /super-admin/*, and the leave APIs
// accept OWNER too — so this guard must accept OWNER or an OWNER would clear the
// proxy and then be bounced from a page they were just authenticated for (the same
// trap the workers / leave-types pages handle).
const PLATFORM_ROLES = ["SUPER_ADMIN", "OWNER"] as const;

/** Whitelisted before they reach the API — junk params never leave the page. */
const PASSTHROUGH = ["search", "branchId", "status", "leaveTypeId", "from", "to", "sortBy", "sortOrder", "page", "limit"] as const;

function friendlyError(status: number, message: string): string {
  switch (status) {
    case 401: return "Your session has expired. Please sign in again.";
    case 403: return "You do not have access to leave requests.";
    case 0: return "Could not reach the server. Check your connection and try again.";
    case 500: return "Something went wrong on our end. Please try again shortly.";
    default: return message || "Could not load leave requests.";
  }
}

export default async function SuperAdminLeavesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // proxy.ts gates /super-admin/*; this is the second line and the API is the third.
  const authUser = await getServerUser();
  if (!authUser || !PLATFORM_ROLES.includes(authUser.userType as (typeof PLATFORM_ROLES)[number])) {
    redirect("/login");
  }

  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const key of PASSTHROUGH) {
    const value = raw[key];
    const v = Array.isArray(value) ? value[0] : value;
    if (v?.trim()) params.set(key, v.trim());
  }

  // List + stats (via the branch-scoped API) alongside the two GLOBAL lookup reads
  // (leave types + branches) for the filters. The lookups are non-sensitive reference
  // data, read server-side exactly as the branch leaves page reads leave types.
  const [listResult, statsResult, leaveTypes, branches] = await Promise.all([
    apiGet<Paginated<BranchLeave>>(`/api/v1/admin/leaves?${params.toString()}`),
    apiGet<LeaveStats>(`/api/v1/admin/leaves/stats?${params.toString()}`),
    prisma.leaveType
      .findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } })
      .catch((): LeaveTypeOption[] => []),
    prisma.branch
      .findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      .catch((): BranchOption[] => []),
  ]);

  const stats: LeaveStats = statsResult.ok
    ? statsResult.data
    : { pending: 0, approved: 0, rejected: 0, cancelled: 0, total: 0, today: 0, onLeaveToday: 0 };

  const filtered = [...params.keys()].some((k) => k !== "page" && k !== "limit");

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="HR" title="Leave Management" subtitle="Review and action worker leave requests across every branch." />

      <LeaveManagementTabs />

      <SuperLeaveStatsCards stats={stats} />

      <SuperLeavesToolbar leaveTypes={leaveTypes} branches={branches} />

      {!listResult.ok ? (
        <LeavesError message={friendlyError(listResult.status, listResult.message)} />
      ) : listResult.data.items.length === 0 ? (
        <LeavesEmpty filtered={filtered} />
      ) : (
        <SuperLeavesView
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
