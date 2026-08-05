import { HealthPage } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

// MODULE: Super Admin — System health

const ROLES: readonly UserType[] = ["SUPER_ADMIN", "OWNER"];

export default async function SuperAdminHealthPage() {
  return <HealthPage allowedRoles={ROLES} basePath="/super-admin" />;
}
