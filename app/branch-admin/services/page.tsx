import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/server-session";
import { BranchServicesWorkspace } from "@/components/branch-services/branch-services-workspace";
import type { ServiceCapabilities } from "@/components/services-admin/types";

// OWNER: Gauransh | MODULE: Branch Admin — Services
//
// The original Branch Pricing workflow is preserved as the first tab; the Manage
// Services and Categories tabs are additive. Capabilities mirror the backend RBAC
// exactly — a Branch Admin may add services and edit only image/description, but may
// NOT delete services or manage categories (super/owner only) — so the UI never
// offers an action the API would reject. proxy.ts gates /branch-admin/*.

// Add + restricted edit only; no delete, no category management.
const BRANCH_CAPABILITIES: ServiceCapabilities = {
  manageCategories: false,
  createService: true,
  deleteService: false,
  editFull: false,
  editRestricted: true,
};

export default async function BranchAdminServicesPage() {
  const authUser = await getServerUser();
  if (!authUser?.branchId) redirect("/login");

  return <BranchServicesWorkspace capabilities={BRANCH_CAPABILITIES} />;
}
