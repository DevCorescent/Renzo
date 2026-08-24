import { BillingDetailPage } from "@/components/operations/billing-detail-page";
import type { UserType } from "@/types/api";

const ROLES: readonly UserType[] = ["BRANCH_ADMIN", "SUPER_ADMIN", "OWNER"];

export default async function BranchAdminBillingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BillingDetailPage allowedRoles={ROLES} invoiceId={id} />;
}
