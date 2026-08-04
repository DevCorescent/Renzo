import { SalePage } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

const ROLES: readonly UserType[] = ["SUPER_ADMIN", "OWNER"];

export default async function SuperAdminSalePage() {
  return <SalePage allowedRoles={ROLES} />;
}
