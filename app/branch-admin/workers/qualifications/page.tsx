import { QualificationPage } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

// MODULE: Branch Admin — Worker qualifications
//
// Scoped to the caller's own branch by requireBranchScope inside the page.

const ROLES: readonly UserType[] = ["BRANCH_ADMIN"];

export default async function BranchAdminQualificationsPage() {
  return <QualificationPage allowedRoles={ROLES} />;
}
