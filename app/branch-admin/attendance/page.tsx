import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { API } from "@/lib/endpoints";
import {
  AttendanceRecordsPage,
  buildSurface,
  type RawSearchParams,
} from "@/components/attendance/attendance-pages";

// MODULE: Branch Admin Attendance — records
//
// The page applies NO branch filtering of its own. The API resolves the caller's
// scope from the session cookie: a BRANCH_ADMIN is pinned to the branch on their
// JWT and a ?branchId they invent is ignored. That is also why a SUPER_ADMIN
// arriving here (proxy.ts admits them to /branch-admin/*) correctly sees every
// branch — the surface is the same, the scope is theirs.

const BRANCH_ROLES = ["BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"] as const;

export default async function BranchAdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const authUser = await getServerUser();
  if (!authUser || !BRANCH_ROLES.includes(authUser.userType as (typeof BRANCH_ROLES)[number])) {
    redirect("/login");
  }

  return (
    <AttendanceRecordsPage
      surface={buildSurface({
        basePath: "/branch-admin/attendance",
        eyebrow: "Branch",
        subtitle: "Mark, review and correct attendance for your branch.",
        userType: authUser.userType,
        markEndpoint: API.branchAdmin.attendance,
      })}
      searchParams={await searchParams}
    />
  );
}
