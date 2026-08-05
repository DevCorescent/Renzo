import { OperationsPage } from "@/components/operations/operations-page";
import type { UserType } from "@/types/api";

// MODULE: Branch Admin — Manual Operations hub

const ROLES: readonly UserType[] = ["BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"];

export default async function BranchAdminOperationsPage() {
  return (
    <OperationsPage
      allowedRoles={ROLES}
      basePath="/branch-admin"
      attendanceApprovalHref="/branch-admin/attendance?entryType=manual"
    />
  );
}
