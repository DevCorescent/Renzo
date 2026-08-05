import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { API } from "@/lib/endpoints";
import {
  AttendanceRecordsPage,
  buildSurface,
  type RawSearchParams,
} from "@/components/attendance/attendance-pages";

// MODULE: Super Admin Attendance — records
//
// proxy.ts gates /super-admin/*; this guard is the second line and the API is the
// third. It must accept OWNER as well as SUPER_ADMIN — proxy.ts admits both, and
// the attendance API admits both, so rejecting OWNER here would bounce a user off
// a page they were just authenticated for (the same trap the workers, leaves and
// leave-types pages handle).

const PLATFORM_ROLES = ["SUPER_ADMIN", "OWNER"] as const;

export default async function SuperAdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const authUser = await getServerUser();
  if (!authUser || !PLATFORM_ROLES.includes(authUser.userType as (typeof PLATFORM_ROLES)[number])) {
    redirect("/login");
  }

  return (
    <AttendanceRecordsPage
      surface={buildSurface({
        basePath: "/super-admin/attendance",
        shiftsPath: "/super-admin/shifts",
        eyebrow: "HR",
        subtitle: "Mark, review and correct attendance across every branch.",
        userType: authUser.userType,
        markEndpoint: API.admin.attendance,
      })}
      searchParams={await searchParams}
    />
  );
}
