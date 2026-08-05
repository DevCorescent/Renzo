import { ExpensesPage } from "@/components/operations/operation-pages";
import type { UserType } from "@/types/api";

const ROLES: readonly UserType[] = ["SUPER_ADMIN", "OWNER"];

export default async function SuperAdminExpensesPage() {
  return <ExpensesPage allowedRoles={ROLES} />;
}
