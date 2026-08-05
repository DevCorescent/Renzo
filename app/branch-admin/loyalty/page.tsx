import { LoyaltyPage } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

const ROLES: readonly UserType[] = ["BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"];

export default async function BranchAdminLoyaltyPage() {
  return <LoyaltyPage allowedRoles={ROLES} />;
}
