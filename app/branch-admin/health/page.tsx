import { HealthPage } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

// MODULE: Branch Admin — System health (own branch only)

const ROLES: readonly UserType[] = ["BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"];

export default async function BranchAdminHealthPage() {
  return <HealthPage allowedRoles={ROLES} basePath="/branch-admin" />;
}
