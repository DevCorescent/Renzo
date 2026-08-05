import { WalkInPage } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

// MODULE: Reception — Walk-in console
//
// The whole front-desk journey on one screen. Every step posts to an endpoint
// that already existed; nothing here re-implements booking, billing or payment.

const ROLES: readonly UserType[] = ["RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"];

export default async function ReceptionWalkInPage() {
  return <WalkInPage allowedRoles={ROLES} />;
}
