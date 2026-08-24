import { BillingPage } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

const ROLES: readonly UserType[] = ["SUPER_ADMIN", "OWNER"];

export default async function SuperAdminBillingPage() {
  return <BillingPage allowedRoles={ROLES} basePath="/super-admin/billing" />;
}
