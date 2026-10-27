import { BillingPage, type BillingSearchParams } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

const ROLES: readonly UserType[] = ["SUPER_ADMIN", "OWNER"];

export default async function SuperAdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<BillingSearchParams>;
}) {
  return <BillingPage allowedRoles={ROLES} basePath="/super-admin/billing" searchParams={await searchParams} />;
}
