import { MembershipSalePage } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

const ROLES: readonly UserType[] = ["RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"];

export default async function ReceptionMembershipPage() {
  return <MembershipSalePage allowedRoles={ROLES} />;
}
