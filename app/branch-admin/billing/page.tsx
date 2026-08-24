import { BillingPage } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

const ROLES: readonly UserType[] = ["BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"];

export default async function BranchAdminBillingPage() {
  return <BillingPage allowedRoles={ROLES} basePath="/branch-admin/billing" />;
}
