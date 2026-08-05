import { WalkInPage } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

// MODULE: Super Admin — Walk-in console
//
// A platform role has no branch of their own, so the service and stylist lists
// arrive unfiltered and the booking endpoint requires an explicit branch. In
// practice a walk-in is served by the branch's own staff; this exists so the hub
// card is never a dead link for an owner looking over a branch's shoulder.

const ROLES: readonly UserType[] = ["SUPER_ADMIN", "OWNER"];

export default async function SuperAdminWalkInPage() {
  return <WalkInPage allowedRoles={ROLES} />;
}
