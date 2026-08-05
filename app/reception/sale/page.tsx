import { SalePage } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

const ROLES: readonly UserType[] = ["RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"];

export default async function ReceptionSalePage() {
  return <SalePage allowedRoles={ROLES} />;
}
