import { OperationsPage } from "@/components/operations/operations-page";
import type { UserType } from "@/types/api";

// MODULE: Super Admin — Manual Operations hub
//
// Accepts OWNER as well: proxy.ts admits both to /super-admin, and rejecting
// OWNER here would bounce a user off a page they were just authenticated for.

const ROLES: readonly UserType[] = ["SUPER_ADMIN", "OWNER"];

export default async function SuperAdminOperationsPage() {
  return (
    <OperationsPage
      allowedRoles={ROLES}
      basePath="/super-admin"
      attendanceApprovalHref="/super-admin/attendance?entryType=manual"
    />
  );
}
