import { WalkInPage } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

// MODULE: Branch Admin — Walk-in console

const ROLES: readonly UserType[] = ["BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"];

export default async function BranchAdminWalkInPage() {
  return <WalkInPage allowedRoles={ROLES} />;
}
