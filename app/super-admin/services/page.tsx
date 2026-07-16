import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { SuperServicesWorkspace } from "@/components/services-admin/super-services-workspace";
import type { ServiceCapabilities } from "@/components/services-admin/types";

// OWNER: Hemant | MODULE: Super Admin — Services
//
// Platform roles (SUPER_ADMIN / OWNER) get full Services & Categories management.
// Capabilities mirror the backend RBAC exactly. proxy.ts gates /super-admin/*; this
// is the second line and the API is the third.
const PLATFORM_ROLES = ["SUPER_ADMIN", "OWNER"] as const;

// Full rights: manage categories, create / fully edit / delete services.
const PLATFORM_CAPABILITIES: ServiceCapabilities = {
  manageCategories: true,
  createService: true,
  deleteService: true,
  editFull: true,
  editRestricted: false,
};

export default async function SuperAdminServicesPage() {
  const authUser = await getServerUser();
  if (!authUser || !PLATFORM_ROLES.includes(authUser.userType as (typeof PLATFORM_ROLES)[number])) {
    redirect("/login");
  }

  return <SuperServicesWorkspace capabilities={PLATFORM_CAPABILITIES} />;
}
