import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { API } from "@/lib/endpoints";
import {
  AttendanceCalendarPage,
  buildSurface,
  type RawSearchParams,
} from "@/components/attendance/attendance-pages";

// MODULE: Super Admin Attendance — calendar

const PLATFORM_ROLES = ["SUPER_ADMIN", "OWNER"] as const;

export default async function SuperAdminAttendanceCalendarPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const authUser = await getServerUser();
  if (!authUser || !PLATFORM_ROLES.includes(authUser.userType as (typeof PLATFORM_ROLES)[number])) {
    redirect("/login");
  }

  return (
    <AttendanceCalendarPage
      surface={buildSurface({
        basePath: "/super-admin/attendance",
        shiftsPath: "/super-admin/shifts",
        eyebrow: "HR",
        subtitle: "A month at a glance across every branch.",
        userType: authUser.userType,
        markEndpoint: API.admin.attendance,
      })}
      searchParams={await searchParams}
    />
  );
}
