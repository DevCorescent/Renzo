import { OperationsPage } from "@/components/operations/operations-page";
import type { UserType } from "@/types/api";

// MODULE: Reception — Manual Operations hub
//
// The front desk's home for every manual action. Which cards appear is decided by
// operationsCapabilitiesFor(), and each card opens an EXISTING surface — the hub
// is a directory of the system's real workflows, not a parallel set of them.

const ROLES: readonly UserType[] = ["RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"];

export default async function ReceptionOperationsPage() {
  return (
    <OperationsPage
      allowedRoles={ROLES}
      basePath="/reception"
      // A receptionist cannot approve attendance, so the tile is not a link for them.
      attendanceApprovalHref={null}
    />
  );
}
