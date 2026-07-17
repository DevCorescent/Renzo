import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { LeaveTypesClient } from "@/components/leave-types/leave-types-client";
import { LeaveManagementTabs } from "@/components/leave-management/leave-management-tabs";

// OWNER: Gauransh | MODULE: Leave Types (HR configuration)
//
// BACKEND: /api/v1/admin/leave-types (GET, POST) + /[id] (GET, PATCH, DELETE),
// SUPER_ADMIN / OWNER only.
//
// A thin server shell: it only guards the route, then hands off to the client
// which does all the fetching against the API. proxy.ts already admits BOTH
// SUPER_ADMIN and OWNER to /super-admin/* — so this check must accept OWNER too, or
// an OWNER would clear the proxy and then be bounced from a page they were just
// authenticated for (the same trap the workers page had).
const PLATFORM_ROLES = ["SUPER_ADMIN", "OWNER"] as const;

export default async function LeaveTypesPage() {
  const authUser = await getServerUser();

  if (
    !authUser ||
    !PLATFORM_ROLES.includes(authUser.userType as (typeof PLATFORM_ROLES)[number])
  ) {
    redirect("/login");
  }

  // The Leave Types config now lives as a tab under the renamed "Leave Management"
  // area. The tab bar is the only addition — LeaveTypesClient is unchanged.
  return (
    <div className="space-y-5">
      <LeaveManagementTabs />
      <LeaveTypesClient />
    </div>
  );
}
