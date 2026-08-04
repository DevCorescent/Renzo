import { QualificationPage } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

// MODULE: Super Admin — Worker qualifications

const ROLES: readonly UserType[] = ["SUPER_ADMIN", "OWNER"];

export default async function SuperAdminQualificationsPage() {
  return <QualificationPage allowedRoles={ROLES} />;
}
