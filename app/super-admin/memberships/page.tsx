import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { MembershipManager } from "@/components/memberships/membership-manager";

// OWNER: Hemant | MODULE: Super Admin — Memberships
//
// FLOW   : Guard the route, then hand off to the client manager which loads analytics
//          + plans and drives create/edit/delete + the customers drawer.
// ACCESS : SUPER_ADMIN only — per the module's access requirement. This is the page's
//          own role check (RBAC/auth infrastructure is untouched); the shared plan
//          endpoints keep their existing SUPER_ADMIN/OWNER guard.

export default async function SuperAdminMembershipsPage() {
  const authUser = await getServerUser();
  if (authUser?.userType !== "SUPER_ADMIN") redirect("/login");

  return <MembershipManager />;
}
