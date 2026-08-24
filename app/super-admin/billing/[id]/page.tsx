import { BillingDetailPage } from "@/components/operations/billing-detail-page";
import type { UserType } from "@/types/api";

const ROLES: readonly UserType[] = ["SUPER_ADMIN", "OWNER"];

export default async function SuperAdminBillingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BillingDetailPage allowedRoles={ROLES} invoiceId={id} />;
}
