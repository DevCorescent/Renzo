import { BillingPage, type BillingSearchParams } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

const ROLES: readonly UserType[] = ["RECEPTIONIST", "BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"];

export default async function ReceptionBillingPage({
  searchParams,
}: {
  searchParams: Promise<BillingSearchParams>;
}) {
  return <BillingPage allowedRoles={ROLES} basePath="/reception/billing" searchParams={await searchParams} />;
}
