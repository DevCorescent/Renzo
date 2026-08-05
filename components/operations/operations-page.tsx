// ============================================================================
// MODULE : Manual Operations — the shared server page
//
// Reception, Branch Admin and Super Admin all render this. It resolves the
// caller's branch scope, loads the day's counters and hands them to the hub.
// Three copies of this is how one of them eventually stops scoping by branch.
// ============================================================================

import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { getServerUser } from "@/lib/server-session";
import { requireBranchScope } from "@/lib/branch-scope";
import { OperationsHub } from "@/components/operations/operations-hub";
import { operationsCapabilitiesFor } from "@/lib/operations";
import { billingCapabilitiesFor } from "@/lib/billing-service";
import { loadOperationsSummary } from "@/lib/operations-service";
import type { UserType } from "@/types/api";

export async function OperationsPage({
  allowedRoles,
  basePath,
  attendanceApprovalHref,
}: {
  allowedRoles: readonly UserType[];
  /** e.g. "/reception" — relative operations resolve against this. */
  basePath: string;
  /** Where the pending-approvals tile links, for roles that can approve. */
  attendanceApprovalHref: string | null;
}) {
  const authUser = await getServerUser();
  if (!authUser || !allowedRoles.includes(authUser.userType)) {
    redirect("/login");
  }

  const staticCaps = operationsCapabilitiesFor(authUser.userType);
  if (!staticCaps.canAccess) redirect("/unauthorized");

  // The same primitive the APIs use, so the hub's numbers and the pages behind
  // its cards agree about which branch the operator is looking at.
  const { scope, error } = requireBranchScope(authUser);
  if (error || !scope) redirect("/unauthorized");

  const [summary, branch] = await Promise.all([
    loadOperationsSummary(scope),
    scope.branchId
      ? prisma.branch.findUnique({
          where: { id: scope.branchId },
          select: { name: true, setting: { select: { allowReceptionBlankBill: true } } },
        })
      : Promise.resolve(null),
  ]);

  // Manual billing is branch-configurable, so its real value comes from
  // billing-service — the same function the API enforces with. Without this the
  // hub offered a receptionist a card whose page then refused their submit, which
  // is exactly what "manual billing is not working" looked like.
  const capability = {
    ...staticCaps,
    canManualBill: billingCapabilitiesFor(
      authUser.userType,
      branch?.setting?.allowReceptionBlankBill ?? false
    ).canBlankBill,
  };

  return (
    <OperationsHub
      capability={capability}
      summary={summary}
      basePath={basePath}
      branchLabel={branch?.name ?? "all branches"}
      attendanceApprovalHref={attendanceApprovalHref}
    />
  );
}
